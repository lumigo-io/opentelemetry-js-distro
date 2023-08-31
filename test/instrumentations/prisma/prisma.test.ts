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
  buildConnectionUrl: (host: string, port: number) => string,
  provider: string,
  port: number,
  startupTimeout: number,
  testContainerConstructor: typeof PostgreSqlContainer | typeof MySqlContainer,
  testContainerImage: string,
  warmupTimeout: number,
};

type StartedContainer = StartedPostgreSqlContainer | StartedMySqlContainer;

const INSTRUMENTATION_NAME = `prisma`;
const INSTRUMENTATION_CLIENT_NAME = `@prisma/client`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 600_000;

const engines: EngineType[] = [
  {
    name: 'postgres',
    buildConnectionUrl: (host: string, port: number) =>
      `postgresql://postgres:postgres@${host}:${port}/postgres`,
    provider: 'postgresql',
    port: 5432,
    startupTimeout: 30_000,
    testContainerConstructor: PostgreSqlContainer,
    testContainerImage: 'postgres:latest',
    warmupTimeout: 60_000,
  },
  {
    name: 'mysql',
    buildConnectionUrl: (host: string, port: number) => `mysql://root:root@${host}:${port}/mysql`,
    provider: 'mysql',
    port: 3306,
    startupTimeout: 30_000,
    testContainerConstructor: MySqlContainer,
    testContainerImage: 'mysql:latest',
    warmupTimeout: 60_000,
  },
];

const startContainer = async (
  engine: EngineType,
  timeout: number = engine.startupTimeout
): Promise<[StartedContainer, string, number]> => {
  const container: StartedContainer = await new engine.testContainerConstructor(
    engine.testContainerImage
  )
    .withExposedPorts(engine.port)
    .withStartupTimeout(timeout)
    .start();
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
          reinstallPackages({ appDir: TEST_APP_DIR });
          fs.mkdirSync(SPANS_DIR, { recursive: true });

          await warmupContainer(engine);
        }, engine.warmupTimeout);

        beforeEach(async function () {
          [container, containerHost, containerPort] = await startContainer(engine);

          // packages must be installed after the container has been started so that
          // we can provide the correct host and port
          installPackages({
            appDir: TEST_APP_DIR,
            packageNames: [INSTRUMENTATION_NAME, INSTRUMENTATION_CLIENT_NAME],
            packageVersion: versionToTest,
            environmentVariables: {
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
            appDir: TEST_APP_DIR,
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

            testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
              OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
            });

            /*const topic = 'test-topic-roundtrip';
              const key = 'test-key-roundtrip';
              const message = 'test-message-roundtrip';
              const host = kafkaContainer.getHost();
              const port = kafkaContainer.getMappedPort(DEFAULT_KAFKA_PORT);
              await testApp.invokeGetPath(
                `/invoke-kafka-producer?topic=${topic}&key=${key}&message=${message}&host=${host}&port=${port}`
              );

              await testApp.invokeGetPath(
                `/invoke-kafka-consumer?topic=${topic}&message=${message}&host=${host}&port=${port}`
              );

              const spans = await testApp.getFinalSpans(4);

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
