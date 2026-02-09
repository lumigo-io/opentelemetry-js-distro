import { mkdirSync } from 'fs';
import 'jest-json';
import { join } from 'path';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from 'testcontainers';

import { itTest } from '../../integration/setup';
import { getSpanByName } from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';


const DOCKER_WARMUP_TIMEOUT = 120_000;
const INSTRUMENTATION_NAME = `pg`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 600_000;

const PG_CONNECT = 'pg.connect';
const PG_QUERY = 'pg.query:CREATE test';


const startPostgresDbContainer = async () => {
  return await new PostgreSqlContainer().start();
};

let warmupState = {
  warmupInitiated: false,
  warmupCompleted: false,
};

const warmupContainer = async () => {
  if (!warmupState.warmupInitiated) {
    warmupState.warmupInitiated = true;
    console.warn(
      `Warming up Postgres container loading, timeout of ${DOCKER_WARMUP_TIMEOUT}ms to account for Docker image pulls...`
    );
    let warmupContainer: StartedPostgreSqlContainer;
    try {
      warmupContainer = await startPostgresDbContainer();
      await warmupContainer.stop();
    } catch (err) {
      console.warn(`Failed to warmup Postgres container: ${err}`);
    }
    warmupState.warmupCompleted = true;
  } else {
    while (!warmupState.warmupCompleted) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
};

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(
  'Instrumentation tests for the postgres package',
  function (versionToTest) {
    let testApp: TestApp;
    let postgresContainer: StartedPostgreSqlContainer;

    beforeAll(async function () {
      reinstallPackages({ appDir: TEST_APP_DIR });

      await warmupContainer();
      mkdirSync(SPANS_DIR, { recursive: true });
    }, DOCKER_WARMUP_TIMEOUT);

    beforeEach(async function () {
      installPackage({
        appDir: TEST_APP_DIR,
        packageName: INSTRUMENTATION_NAME,
        packageVersion: versionToTest,
      });

      postgresContainer = await startPostgresDbContainer();

      console.info(`Postgres container started, on: ${postgresContainer.getHost()}: ${postgresContainer.getPort()}`);

      testApp = new TestApp(
        TEST_APP_DIR,
        INSTRUMENTATION_NAME,
        {
          spanDumpPath: `${SPANS_DIR}/basic-@${versionToTest}.json`,
          env: {
            POSTGRES_HOST: postgresContainer.getHost().toString(),
            POSTGRES_PORT: postgresContainer.getPort().toString(),
            POSTGRES_DATABASE: postgresContainer.getDatabase().toString(),
            POSTGRES_USER: postgresContainer.getUsername().toString(),
            POSTGRES_PASSWORD: postgresContainer.getPassword().toString(),
            OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
          }
        }
      );
    }, DOCKER_WARMUP_TIMEOUT);

    afterEach(async function () {
      try {
        await testApp.kill();
      } catch (err) {
        console.warn('Failed to kill test app', err);
      }

      if (postgresContainer) {
        await postgresContainer.stop();
        console.log('Postgres container stopped successfully');
      } else {
        console.log('Postgres container was not initialized');
      }

      uninstallPackage({
        appDir: TEST_APP_DIR,
        packageName: INSTRUMENTATION_NAME,
        packageVersion: versionToTest,
      });
    });

    itTest(
      {
        testName: `pg: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        await testApp.invokeGetPath(`/test-postgres`);

        const spans = await testApp.getFinalSpans(3);
        expect(spans).toHaveLength(3);

        const connectSpan = getSpanByName(spans, PG_CONNECT);
        console.log(connectSpan);
        expect(connectSpan.attributes["db.system"]).toEqual("postgresql");
        expect(connectSpan.attributes["db.name"]).toEqual("test");
        expect(connectSpan.attributes["db.connection_string"]).not.toBeNull();

        const querySpan = getSpanByName(spans, PG_QUERY);
        console.log(querySpan);
        expect(querySpan.attributes["db.system"]).toEqual("postgresql");
        expect(querySpan.attributes["db.name"]).toEqual("test");
        expect(connectSpan.attributes["db.connection_string"]).not.toBeNull();
        expect(connectSpan.attributes["db.statement"]).not.toBeNull();
      }
    );
  }
);
