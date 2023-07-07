import { mkdirSync } from 'fs';
import { join } from 'path';
import 'jest-json';

import { startMongoContainer, stopMongoContainer } from './appUtils';
import { itTest } from '../../integration/setup';
import { getSpanByName } from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import {
  filterMongoSpans,
  getExpectedResourceAttributes,
  getExpectedSpan,
  getExpectedSpanWithParent,
} from './mongodbTestUtils';

const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 300000;
const INSTRUMENTATION_NAME = `mongodb`;
const INSERT_CMD = 'mongodb.insert';
const FIND_CMD = 'mongodb.find';
const UPDATE_CMD = 'mongodb.update';
const REMOVE_CMD = 'mongodb.remove';
const CREATE_INDEX_CMD = 'mongodb.createIndexes';
const DELETE_CMD = 'mongodb.delete';
const expectedIndexStatement = expect.stringMatching(
  /"createIndexes":"insertOne","indexes":\[{"name":"a_1","key"/
);

describe.each(versionsToTest('mongodb', 'mongodb'))(
  'Instrumentation tests for the mongodb package',
  (versionToTest) => {
    let testApp: TestApp;
    let mongoDbUrl: string;

    beforeAll(async () => {
      mongoDbUrl = ensureIPv4(
        // On Node.js 18 there are pesky issues with IPv6; ensure we use IPv4
        await startMongoContainer()
      );

      console.info(`Mongo container started, URL: ${mongoDbUrl}`);

      reinstallPackages(TEST_APP_DIR);

      mkdirSync(SPANS_DIR, { recursive: true });
    });
    
    beforeEach(async () => {
      installPackage(TEST_APP_DIR, 'mongodb', versionToTest);
      
      testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, `${SPANS_DIR}/basic-@${versionToTest}.json`, {
        MONGODB_URL: mongoDbUrl,
        OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
      });
    });

    afterEach(async () => {
      if (testApp) {
        console.info('Killing test app...');
        const exitStatus = await testApp.kill();
        console.info(`Test app exited with code '${exitStatus}'`);
      }

      uninstallPackage(TEST_APP_DIR, 'mongodb', versionToTest);
    });

    afterAll(async () => {
      await stopMongoContainer();
    });

    itTest(
      {
        testName: `basics: ${versionToTest}`,
        packageName: 'mongodb',
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async ()=> {
        const spans = await testApp.invokeGetPathAndRetrieveSpanDump(`/test-mongodb`);

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
  }
);

function ensureIPv4(mongoUrl: string) {
  const url = new URL(mongoUrl);
  url.hostname = '127.0.0.1';
  return url.toString();  
}