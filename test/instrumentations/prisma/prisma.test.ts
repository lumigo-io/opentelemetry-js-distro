import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';
import { MySqlContainer, PostgreSqlContainer, StartedMySqlContainer, StartedPostgreSqlContainer } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { TestApp } from '../../utils/test-apps';
import { installPackages, reinstallPackages, uninstallPackages } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';

const DEFAULT_POSTGRES_PORT = 5432;
const DEFAULT_MYSQL_PORT = 3306;
const DOCKER_START_TIMEOUT = 30_000;
const DOCKER_WARMUP_TIMEOUT = 60_000;
const INSTRUMENTATION_NAME = `prisma`;
const INSTRUMENTATION_CLIENT_NAME = `@prisma/client`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 600_000;

const enum ContainerType {
  POSTGRES = 'Postgres',
  MYSQL = 'MySQL',
};

const startPostgresContainer = async (): Promise<[StartedPostgreSqlContainer, string, number]> => {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:latest')
    .withExposedPorts(DEFAULT_POSTGRES_PORT)
    .withStartupTimeout(DOCKER_START_TIMEOUT)
    .start();
  const host = container.getHost();
  const port = container.getMappedPort(DEFAULT_POSTGRES_PORT);
  console.info(`Postgres container started on ${host}:${port}...`);
  return [container, host, port];
};

const mySqlContainer = async (): Promise<[StartedMySqlContainer, string, number]> => {
  const container: StartedMySqlContainer = await new MySqlContainer('mysql:latest')
    .withExposedPorts(DEFAULT_MYSQL_PORT)
    .withStartupTimeout(DOCKER_START_TIMEOUT)
    .start();
  const host = container.getHost();
  const port = container.getMappedPort(DEFAULT_MYSQL_PORT);
  console.info(`MySQL container started on ${host}:${port}...`);
  return [container, host, port];
};

let warmupState = {
  [ContainerType.POSTGRES]: {
    warmupInitiated: false,
    warmupCompleted: false,
  },
  [ContainerType.MYSQL]: {
    warmupInitiated: false,
    warmupCompleted: false,
  },
};

const warmupContainer = async (containerType: ContainerType): Promise<boolean> => {
  if (!warmupState[containerType].warmupInitiated) {
    warmupState[containerType].warmupInitiated = true;
    console.warn(
      `Warming up ${containerType} container loading, timeout of ${DOCKER_WARMUP_TIMEOUT}ms to account for Docker image pulls...`
    );
    let warmupContainer: StartedPostgreSqlContainer | StartedMySqlContainer;
    try {
      [ warmupContainer ] = containerType == ContainerType.POSTGRES ?
        await startPostgresContainer() : await mySqlContainer();
      await warmupContainer.stop();
    } catch (err) {
      console.warn(`Failed to warmup ${containerType} container: ${err}`);
    }
    warmupState[containerType].warmupCompleted = true;
  } else {
    while (!warmupState[containerType].warmupCompleted) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return true;
};

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(
  `Instrumentation tests for the ${INSTRUMENTATION_NAME} package`,
  function (versionToTest) {
    let testApp: TestApp;
    let postgresContainer: StartedPostgreSqlContainer;
    let mysqlContainer: StartedMySqlContainer;
    let containerHost: string;
    let containerPort: number;

    beforeAll(async function () {
      reinstallPackages(TEST_APP_DIR);
      fs.mkdirSync(SPANS_DIR, { recursive: true });
      installPackages(TEST_APP_DIR, [INSTRUMENTATION_NAME, INSTRUMENTATION_CLIENT_NAME], versionToTest);

      await Promise.all([
        warmupContainer(ContainerType.POSTGRES),
        warmupContainer(ContainerType.MYSQL)
      ]);
    }, DOCKER_WARMUP_TIMEOUT);

    afterEach(async function () {
      if (testApp) {
        console.info('Killing test app...');
        await testApp.kill();
      } else {
        console.warn('Test app was not run.');
      }
      if (postgresContainer) {
        console.info('Stopping Postgres container...');
        await postgresContainer.stop();
      } else {
        console.warn('Postgres container was not started.');
      }
      if (mysqlContainer) {
        console.info('Stopping MySQL container...');
        await mysqlContainer.stop();
      } else {
        console.warn('MySQL container was not started.');
      }
    });

    afterAll(function () {
      uninstallPackages(TEST_APP_DIR, [INSTRUMENTATION_NAME, INSTRUMENTATION_CLIENT_NAME], versionToTest);
    });

    itTest(
      {
        testName: `postgres basics: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        [ postgresContainer, containerHost, containerPort ] = await startPostgresContainer();
        const exporterFile = `${SPANS_DIR}/postgres-basics.${INSTRUMENTATION_NAME}@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });
      }
    );
  }
);
