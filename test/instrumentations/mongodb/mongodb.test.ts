import { mkdirSync } from 'fs';
import 'jest-json';
import { join } from 'path';

import { MongoDBContainer, StartedMongoDBContainer } from 'testcontainers';

import { itTest } from '../../integration/setup';
import { getSpanByName, getSpansByAttribute } from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import {
  filterMongoSpans,
  getExpectedResourceAttributes,
  getExpectedSpan,
  getExpectedSpanWithParent,
} from './mongodbTestUtils';

const DOCKER_WARMUP_TIMEOUT = 60_000;
const INSTRUMENTATION_NAME = `mongodb`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 600_000;

const INSERT_CMD = 'mongodb.insert';
const FIND_CMD = 'mongodb.find';
const UPDATE_CMD = 'mongodb.update';
const REMOVE_CMD = 'mongodb.remove';
const CREATE_INDEX_CMD = 'mongodb.createIndexes';
const DELETE_CMD = 'mongodb.delete';

const expectedIndexStatement = expect.stringMatching(
  /"createIndexes":"insertOne","indexes":\[{"name":"a_1","key"/
);

const startMongoDbContainer = async () => {
  return await new MongoDBContainer().start();
};

let warmupState = {
  warmupInitiated: false,
  warmupCompleted: false,
};

const warmupContainer = async () => {
  if (!warmupState.warmupInitiated) {
    warmupState.warmupInitiated = true;
    console.warn(
      `Warming up MongoDB container loading, timeout of ${DOCKER_WARMUP_TIMEOUT}ms to account for Docker image pulls...`
    );
    let warmupContainer: StartedMongoDBContainer;
    try {
      warmupContainer = await startMongoDbContainer();
      await warmupContainer.stop();
    } catch (err) {
      console.warn(`Failed to warmup MongoDB container: ${err}`);
    }
    warmupState.warmupCompleted = true;
  } else {
    while (!warmupState.warmupCompleted) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
};

function getMongoContainerConnectionUrl(mongoContainer: StartedMongoDBContainer, versionToTest: string): URL {
  let mongoConnectionUrl = new URL(mongoContainer.getConnectionString());
  // On Node.js 18 there are pesky issues with IPv6; ensure we use IPv4
  mongoConnectionUrl.hostname = '127.0.0.1';

  if (!versionToTest.startsWith('3.')) {
    /*
     * Prevent `MongoServerSelectionError: getaddrinfo EAI_AGAIN` errors
     * by disabling MongoDB topology.
     */
    mongoConnectionUrl.searchParams.set('directConnection', 'true');
  }

  console.info(`Mongo container started, URL: ${mongoConnectionUrl}`);
  return mongoConnectionUrl;
}

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(
  'Instrumentation tests for the mongodb package',
  function (versionToTest) {
    let testApp: TestApp;
    let mongoContainer: StartedMongoDBContainer;

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

      mongoContainer = await startMongoDbContainer();
      getMongoContainerConnectionUrl(mongoContainer, versionToTest);
    }, DOCKER_WARMUP_TIMEOUT);

    afterEach(async function () {
      try {
        await testApp.kill();
      } catch (err) {
        console.warn('Failed to kill test app', err);
      }

      if (mongoContainer) {
        await mongoContainer.stop();
        console.log('Mongo container stopped successfully');
      } else {
        console.log('Mongo container was not initialized');
      }

      uninstallPackage({
        appDir: TEST_APP_DIR,
        packageName: INSTRUMENTATION_NAME,
        packageVersion: versionToTest,
      });
    });

    itTest(
      {
        testName: `basics: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile =  `${SPANS_DIR}/basic-@${versionToTest}.json`
        let mongoConnectionUrl = getMongoContainerConnectionUrl(mongoContainer, versionToTest);
          testApp = new TestApp(
          TEST_APP_DIR,
          INSTRUMENTATION_NAME,
          {
            spanDumpPath: exporterFile,
            env: {
              MONGODB_URL: mongoConnectionUrl.toString(),
              OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
            }
          });        
        await testApp.invokeGetPath(`/test-mongodb`);

        const spans = await testApp.getFinalSpans(5);
        expect(filterMongoSpans(spans)).toHaveLength(5);

        let resourceAttributes = getExpectedResourceAttributes();

        expect(getSpanByName(spans, INSERT_CMD)).toMatchObject(
          getExpectedSpan(INSERT_CMD, resourceAttributes, expect.stringMatching(/"a":1,"_id":/))
        );

        const findSpan = getSpanByName(spans, FIND_CMD);
        if (versionToTest.startsWith('3')) {
          expect(findSpan).toMatchObject(
            getExpectedSpanWithParent(FIND_CMD, resourceAttributes, '{"a":1}')
          );
        } else {
          expect(findSpan).toMatchObject(
            getExpectedSpanWithParent(
              FIND_CMD,
              resourceAttributes,
              '{"find":"insertOne","filter":{"a":1}}'
            )
          );
        }

        const updateSpan = getSpanByName(spans, UPDATE_CMD);
        if (versionToTest.startsWith('3')) {
          expect(updateSpan).toMatchObject(
            getExpectedSpanWithParent(UPDATE_CMD, resourceAttributes, '{"a":1}')
          );
        } else {
          expect(updateSpan).toMatchObject(
            getExpectedSpanWithParent(
              UPDATE_CMD,
              resourceAttributes,
              '{"update":"insertOne","updates":[{"q":{"a":1},"u":{"$set":{"b":1}}}],"ordered":true}'
            )
          );
        }

        if (versionToTest.startsWith('3')) {
          expect(getSpanByName(spans, REMOVE_CMD)).toMatchObject(
            getExpectedSpanWithParent(REMOVE_CMD, resourceAttributes, '{"b":1}')
          );
        } else {
          expect(getSpanByName(spans, DELETE_CMD)).toMatchObject(
            getExpectedSpanWithParent(
              DELETE_CMD,
              resourceAttributes,
              '{"delete":"insertOne","deletes":[{"q":{"b":1},"limit":0}],"ordered":true}'
            )
          );
        }

        expect(getSpanByName(spans, CREATE_INDEX_CMD)).toMatchObject(
          getExpectedSpanWithParent(
            CREATE_INDEX_CMD,
            resourceAttributes,
            expectedIndexStatement,
            '$cmd'
          )
        );
      }
    );

    itTest(
      {
        testName: `filter isMaster request: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile =  `${SPANS_DIR}/filter-isMaster@${versionToTest}.json`
        let mongoConnectionUrl = getMongoContainerConnectionUrl(mongoContainer, versionToTest);
        testApp = new TestApp(
          TEST_APP_DIR,
          INSTRUMENTATION_NAME,
          {
            spanDumpPath: exporterFile,
            env: {
              MONGODB_URL: mongoConnectionUrl.toString(),
              OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
            }
          });

        // older versions of mongodb driver add extra spans
        const expectedSpanCount = versionToTest.startsWith('3') ? 2 : 1;
        const expectedDbSystemAttributeSpans = versionToTest.startsWith('3') ? 1 : 0;

        await testApp.invokeGetPath(`/mongodb-isMaster`);

        let spans = await testApp.getFinalSpans(expectedSpanCount);
        expect(getSpansByAttribute(spans, 'db.system', 'mongodb')).toHaveLength(expectedDbSystemAttributeSpans);

      }
    );

    itTest(
      {
        testName: `filter isMaster disabled: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile =  `${SPANS_DIR}/filter-isMaster-disabled@${versionToTest}.json`
        let mongoConnectionUrl = getMongoContainerConnectionUrl(mongoContainer, versionToTest);
        testApp = new TestApp(
          TEST_APP_DIR,
          INSTRUMENTATION_NAME,
          {
            spanDumpPath: exporterFile,
            env: {
              MONGODB_URL: mongoConnectionUrl.toString(),
              OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
              LUMIGO_REDUCED_MONGO_INSTRUMENTATION: 'false'
            }
          });

        // older versions of mongodb driver add extra spans
        const expectedSpanCount = versionToTest.startsWith('3') ? 3 : 2;
        await testApp.invokeGetPath(`/mongodb-isMaster`);
        let spans = await testApp.getFinalSpans(expectedSpanCount);
        expect(getSpansByAttribute(spans, 'db.operation', 'isMaster')).toHaveLength(1);

      }
    );
  }
);
