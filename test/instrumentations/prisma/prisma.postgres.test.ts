import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { getSpanByName } from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { installPackages, reinstallPackages, uninstallPackages } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import {
  filterPrismaSpans,
  getExpectedResourceAttributes,
  getExpectedSpan,
  getQueryOperationSpans,
  getQuerySpans,
  hasExpectedClientConnectionSpans,
  hasExpectedQueryConnectionSpans,
} from './prismaTestUtils';

type DatabaseConfiguration = {
  database: string,
  username: string,
  password: string,
};

type EngineType = {
  name: string,
  appDir: string,
  databaseConfiguration: DatabaseConfiguration,
  provider: string,
  port: number,
  startupTimeout: number,
  warmupTimeout: number,
};

type StartedContainer = StartedPostgreSqlContainer;

const DEFAULT_POSTGRES_PORT = 5432;
const DEFAULT_STARTUP_TIMEOUT = 45_000; // includes time to install packages
const DEFAULT_WARMUP_TIMEOUT = 60_000;
const INSTRUMENTATION_NAME = `prisma`;
const INSTRUMENTATION_CLIENT_NAME = `@prisma/client`;
const SPANS_DIR = join(__dirname, 'spans');
const TEARDOWN_TIMEOUT = 15_000;
const TEST_TIMEOUT = 600_000;

const buildConnectionUrl = (engine: EngineType, host: string, port: number): string => {
  switch (engine.name) {
    case 'postgres':
      const configuration = engine.databaseConfiguration;
      return `${engine.provider}://${configuration.username}:${configuration.password}@${host}:${port}/${configuration.database}`;
    default:
      throw new Error(`Unsupported engine: ${engine.name}`);
  }
};

const engines: EngineType[] = [
  {
    name: 'postgres',
    appDir: join(__dirname, 'postgres_app'),
    databaseConfiguration: {
      database: 'postgres',
      username: 'testuser',
      password: 'testpassword',
    },
    provider: 'postgresql',
    port: DEFAULT_POSTGRES_PORT,
    startupTimeout: DEFAULT_STARTUP_TIMEOUT,
    warmupTimeout: DEFAULT_WARMUP_TIMEOUT,
  },
];

const startPostgresContainer = async (
  configuration: DatabaseConfiguration,
  timeout: number = DEFAULT_STARTUP_TIMEOUT
): Promise<StartedPostgreSqlContainer> => {
  return await new PostgreSqlContainer('postgres:latest')
    .withExposedPorts(DEFAULT_POSTGRES_PORT)
    .withStartupTimeout(timeout)
    .withDatabase(configuration.database)
    .withUsername(configuration.username)
    .withPassword(configuration.password)
    .start();
};

const startContainer = async (
  engine: EngineType,
  timeout: number = engine.startupTimeout
): Promise<[StartedContainer, string, number]> => {
  let container: StartedContainer;
  switch (engine.name) {
    case 'postgres':
      container = await startPostgresContainer(engine.databaseConfiguration, timeout);
      break;
    default:
      throw new Error(`Unsupported engine: ${engine.name}`);
  }
  const host = container.getHost();
  const port = container.getMappedPort(engine.port);
  console.info(`${engine.name} container started on ${host}:${port}...`);
  return [container, host, port];
};

let warmupState = {
  postgres: {
    warmupInitiated: false,
    warmupCompleted: false,
  },
};

const warmupContainer = async (engine: EngineType): Promise<boolean> => {
  if (!warmupState[engine.name].warmupInitiated) {
    warmupState[engine.name].warmupInitiated = true;
    console.warn(
      `Warming up ${engine.name} container loading, timeout of ${engine.warmupTimeout}ms to account for Docker image pulls...`
    );
    let warmupContainer: StartedPostgreSqlContainer;
    try {
      [warmupContainer] = await startContainer(engine, engine.warmupTimeout);
      await warmupContainer.stop();
    } catch (err) {
      console.warn(`Failed to warmup ${engine.name} container: ${err}`);
    }
    warmupState[engine.name].warmupCompleted = true;
  } else {
    while (!warmupState[engine.name].warmupCompleted) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return true;
};

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(
  `Instrumentation tests for the ${INSTRUMENTATION_NAME} package`,
  function (versionToTest) {
    for (const engine of engines) {
      describe(`prisma ${versionToTest} against the ${engine.name} database engine`, function () {
        let testApp: TestApp;
        let container: StartedPostgreSqlContainer;
        let containerHost: string;
        let containerPort: number;

        beforeAll(async function () {
          reinstallPackages({ appDir: engine.appDir });
          fs.mkdirSync(SPANS_DIR, { recursive: true });

          await warmupContainer(engine);
        }, engine.warmupTimeout);

        beforeEach(async function () {
          [container, containerHost, containerPort] = await startContainer(engine);

          // packages must be installed after the container has been started so that
          // the correct connection url is available for the client generation
          // having said that, each time the test app starts it will re-generate the
          // client because the generation on install is not reliable
          installPackages({
            appDir: engine.appDir,
            packageNames: [INSTRUMENTATION_NAME, INSTRUMENTATION_CLIENT_NAME],
            packageVersion: versionToTest,
            environmentVariables: {
              DATABASE_URL: buildConnectionUrl(engine, containerHost, containerPort),
            },
          });

          TestApp.runAuxiliaryScript('setup', engine.appDir, {
            DATABASE_URL: buildConnectionUrl(engine, containerHost, containerPort),
          });
        }, engine.startupTimeout);

        afterEach(async function () {
          try {
            await testApp.kill();
          } catch (err) {
            console.warn('Failed to kill test app', err);
          }

          try {
            TestApp.runAuxiliaryScript('teardown', engine.appDir);
          } catch (err) {
            console.warn('Failed to run teardown script', err);
          }

          if (container) {
            console.info(`Stopping ${engine.name} container...`);
            await container.stop();
          } else {
            console.warn(`${engine.name} container was not started.`);
          }
        }, TEARDOWN_TIMEOUT);

        afterAll(function () {
          uninstallPackages({
            appDir: engine.appDir,
            packageNames: [INSTRUMENTATION_NAME, INSTRUMENTATION_CLIENT_NAME],
            packageVersion: versionToTest,
          });
        });

        itTest(
          {
            testName: `${engine.name} basics: ${versionToTest}`,
            packageName: INSTRUMENTATION_NAME,
            version: versionToTest,
            timeout: TEST_TIMEOUT,
          },
          async function () {
            const exporterFile = `${SPANS_DIR}/${engine.name}-basics.${INSTRUMENTATION_NAME}@${versionToTest}.json`;

            testApp = new TestApp(engine.appDir, INSTRUMENTATION_NAME, { spanDumpPath: exporterFile, env: {
              DATABASE_URL: buildConnectionUrl(engine, containerHost, containerPort),
              OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
            }});

            await testApp.invokeGetPath(`/add-user?name=Alice&email=alice@prisma.io`);

            await testApp.invokeGetPath(`/get-users`);

            // from prisma 4.14.0 onwards, the number of spans is
            // inconsistent, we look for a minimum of 18 spans in total
            const spans = await testApp.getFinalSpans(18);

            const prismaSpans = filterPrismaSpans(spans);

            const resourceAttributes = getExpectedResourceAttributes();

            expect(
              hasExpectedClientConnectionSpans({
                spans: prismaSpans,
                engine,
                expectedInstantiations: 2,
                expectedQueries: 2,
              })
            ).toBe(true);

            const queryConnectionSpans = getQuerySpans(prismaSpans);

            // identify the insert query spans by trace id
            const insertQueryTraceId = queryConnectionSpans[0].traceId;
            const insertQuerySpans = queryConnectionSpans.filter(
              (span) => span.traceId === insertQueryTraceId
            );

            expect(hasExpectedQueryConnectionSpans(insertQuerySpans, engine)).toBe(true);

            // after version 5, postgres inserts have been simplified to not use transactions;
            // we need to treat the rest of the query spans as optional
            const insertQueryDbQuerySpans = getQueryOperationSpans(insertQuerySpans).filter(
              (span) => span.name === 'prisma:engine:db_query'
            );

            try {
              expect(insertQueryDbQuerySpans).toHaveLength(4);

              expect(insertQueryDbQuerySpans[0]).toMatchObject(
                getExpectedSpan({
                  name: 'prisma:engine:db_query',
                  resourceAttributes,
                  attributes: {
                    'db.statement': 'BEGIN',
                  },
                })
              );

              expect(insertQueryDbQuerySpans[1]).toMatchObject(
                getExpectedSpan({
                  name: 'prisma:engine:db_query',
                  resourceAttributes,
                  attributes: {
                    'db.statement': expect.stringMatching(/^INSERT INTO .*User/),
                  },
                })
              );

              expect(insertQueryDbQuerySpans[2]).toMatchObject(
                getExpectedSpan({
                  name: 'prisma:engine:db_query',
                  resourceAttributes,
                  attributes: {
                    'db.statement': expect.stringMatching(/^SELECT .*User/),
                  },
                })
              );

              expect(insertQueryDbQuerySpans[3]).toMatchObject(
                getExpectedSpan({
                  name: 'prisma:engine:db_query',
                  resourceAttributes,
                  attributes: {
                    'db.statement': 'COMMIT',
                  },
                })
              );
            } catch (err) {
              expect(insertQueryDbQuerySpans).toHaveLength(1);

              expect(insertQueryDbQuerySpans[0]).toMatchObject(
                getExpectedSpan({
                  name: 'prisma:engine:db_query',
                  resourceAttributes,
                  attributes: {
                    'db.statement': expect.stringMatching(/^INSERT INTO .*User/),
                  },
                })
              );
            }

            expect(getSpanByName(insertQuerySpans, 'prisma:engine:serialize')).toMatchObject(
              getExpectedSpan({
                name: 'prisma:engine:serialize',
                resourceAttributes,
                attributes: {},
              })
            );

            expect(getSpanByName(insertQuerySpans, 'prisma:client:operation')).toMatchObject(
              getExpectedSpan({
                name: 'prisma:client:operation',
                resourceAttributes,
                attributes: {
                  method: 'create',
                  model: 'User',
                  name: 'User.create',
                },
              })
            );

            expect(getSpanByName(insertQuerySpans, 'prisma:engine')).toMatchObject(
              getExpectedSpan({
                name: 'prisma:engine',
                resourceAttributes,
                attributes: {},
              })
            );

            // identify the select query spans by trace id
            const selectQuerySpans = queryConnectionSpans.filter(
              (span) => span.traceId !== insertQueryTraceId
            );

            expect(hasExpectedQueryConnectionSpans(selectQuerySpans, engine)).toBe(true);

            expect(getSpanByName(selectQuerySpans, 'prisma:client:operation')).toMatchObject(
              getExpectedSpan({
                name: 'prisma:client:operation',
                resourceAttributes,
                attributes: {
                  method: 'findMany',
                  model: 'User',
                  name: 'User.findMany',
                },
              })
            );

            const selectQueryDbQuerySpans = getQueryOperationSpans(selectQuerySpans).filter(
              (span) => span.name === 'prisma:engine:db_query'
            );
            expect(selectQueryDbQuerySpans).toHaveLength(1);

            expect(selectQueryDbQuerySpans[0]).toMatchObject(
              getExpectedSpan({
                name: 'prisma:engine:db_query',
                resourceAttributes,
                attributes: {
                  'db.statement': expect.stringMatching(/^SELECT .*User/),
                },
              })
            );

            expect(getSpanByName(selectQuerySpans, 'prisma:engine:serialize')).toMatchObject(
              getExpectedSpan({
                name: 'prisma:engine:serialize',
                resourceAttributes,
                attributes: {},
              })
            );

            expect(getSpanByName(selectQuerySpans, 'prisma:engine')).toMatchObject(
              getExpectedSpan({
                name: 'prisma:engine',
                resourceAttributes,
                attributes: {},
              })
            );
          }
        );
      }); // describe engine function
    } // loop over engines
  } // describe version function
);
