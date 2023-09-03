import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';
import {
  MySqlContainer,
  PostgreSqlContainer,
  StartedMySqlContainer,
  StartedPostgreSqlContainer,
} from 'testcontainers';
import { itTest } from '../../integration/setup';
import { TestApp } from '../../utils/test-apps';
import { installPackages, reinstallPackages, uninstallPackages } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';

type EngineType = {
  name: string,
  appDir: string,
  buildConnectionUrl: (host: string, port: number) => string,
  database: string,
  password: string,
  provider: string,
  port: number,
  startupTimeout: number,
  testContainerImage: string,
  username: string,
  warmupTimeout: number,
};

type StartedContainer = StartedPostgreSqlContainer | StartedMySqlContainer;

const INSTRUMENTATION_NAME = `prisma`;
const INSTRUMENTATION_CLIENT_NAME = `@prisma/client`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_TIMEOUT = 600_000;

const engines: EngineType[] = [
  {
    name: 'mysql',
    appDir: join(__dirname, 'mysql_app'),
    buildConnectionUrl: (host: string, port: number) =>
      `mysql://testuser:testpassword@${host}:${port}/testdb`,
    database: 'testdb',
    password: 'testpassword',
    provider: 'mysql',
    port: 3306,
    startupTimeout: 30_000,
    testContainerImage: 'mysql:latest',
    username: 'testuser',
    warmupTimeout: 60_000,
  },
  {
    name: 'postgres',
    appDir: join(__dirname, 'postgres_app'),
    // DATABASE_URL="postgresql://username:mypassword@localhost:5432/college_db?schema=public"

    buildConnectionUrl: (host: string, port: number) =>
      `postgresql://testuser:testpassword@${host}:${port}/postgres`,
    database: 'postgres',
    password: 'testpassword',
    provider: 'postgresql',
    port: 5432,
    startupTimeout: 30_000,
    testContainerImage: 'postgres:latest',
    username: 'testuser',
    warmupTimeout: 60_000,
  },
];

const startPostgresContainer = async (
  engine: EngineType,
  timeout: number = engine.startupTimeout
): Promise<StartedPostgreSqlContainer> => {
  return await new PostgreSqlContainer(engine.testContainerImage)
    .withExposedPorts(engine.port)
    .withStartupTimeout(timeout)
    .withDatabase(engine.database)
    .withUsername(engine.username)
    .withPassword(engine.password)
    .start();
};

const startMySqlContainer = async (
  engine: EngineType,
  timeout: number = engine.startupTimeout
): Promise<StartedMySqlContainer> => {
  return await new MySqlContainer(engine.testContainerImage)
    .withExposedPorts(engine.port)
    .withStartupTimeout(timeout)
    .withDatabase(engine.database)
    .withUsername(engine.username)
    .withUserPassword(engine.password)
    .start();
};

const startContainer = async (
  engine: EngineType,
  timeout: number = engine.startupTimeout
): Promise<[StartedContainer, string, number]> => {
  let container: StartedContainer;
  switch (engine.name) {
    case 'postgres':
      container = await startPostgresContainer(engine, timeout);
      break;
    case 'mysql':
      container = await startMySqlContainer(engine, timeout);
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
  mysql: {
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
    let warmupContainer: StartedPostgreSqlContainer | StartedMySqlContainer;
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
        let container: StartedPostgreSqlContainer | StartedMySqlContainer;
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
          installPackages({
            appDir: engine.appDir,
            packageNames: [INSTRUMENTATION_NAME, INSTRUMENTATION_CLIENT_NAME],
            packageVersion: versionToTest,
            environmentVariables: {
              DATABASE_PROVIDER: engine.provider,
              DATABASE_URL: engine.buildConnectionUrl(containerHost, containerPort),
            },
          });
        }, engine.startupTimeout);

        afterEach(async function () {
          if (testApp) {
            console.info('Killing test app...');
            await testApp.kill();
          } else {
            console.warn('Test app was not run.');
          }
          if (container) {
            console.info(`Stopping ${engine.name} container...`);
            await container.stop();
          } else {
            console.warn(`${engine.name} container was not started.`);
          }
        });

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

            testApp = new TestApp(engine.appDir, INSTRUMENTATION_NAME, exporterFile, {
              OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
              DATABASE_URL: engine.buildConnectionUrl(containerHost, containerPort),
            });

            await testApp.invokeGetPath(`/add-user?name=Alice&email=alice@prisma.io`);

            await testApp.invokeGetPath(`/get-users`);

            const spans = await testApp.getFinalSpans(4);
            expect(spans).toHaveLength(4);

            /*
              const kafkaJsSpans = filterKafkaJsSpans(spans, topic);
              expect(kafkaJsSpans).toHaveLength(2);

              let resourceAttributes = getExpectedResourceAttributes();

              const sendSpan = getSpanByKind(kafkaJsSpans, SpanKind.PRODUCER);
              expect(sendSpan).toMatchObject(
                getExpectedSpan({
                  spanKind: SpanKind.PRODUCER,
                  resourceAttributes,
                  host,
                  topic,
                  message,
                })
              );

              const receiveSpan = getSpanByKind(kafkaJsSpans, SpanKind.CONSUMER);
              expect(receiveSpan).toMatchObject(
                getExpectedSpan({
                  spanKind: SpanKind.CONSUMER,
                  resourceAttributes,
                  host,
                  topic,
                  message,
                })
              );
              */
          }
        );
      }); // describe engine function
    } // loop over engines
  } // describe version function
);
