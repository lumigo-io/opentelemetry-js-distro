import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { getSpanByName } from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import { filterRedisSpans, getExpectedResourceAttributes, getExpectedSpan } from './redisTestUtils';

const DEFAULT_REDIS_PORT = 6379;
const DOCKER_WARMUP_TIMEOUT = 30_000;
const INSTRUMENTATION_NAME = `redis`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 600_000;

const startRedisContainer = async () => {
  return await new GenericContainer('redis:latest')
    .withExposedPorts(DEFAULT_REDIS_PORT)
    .withStartupTimeout(DOCKER_WARMUP_TIMEOUT)
    .start();
};

let warmupState = {
  warmupInitiated: false,
  warmupCompleted: false,
};

const warmupContainer = async () => {
  if (!warmupState.warmupInitiated) {
    warmupState.warmupInitiated = true;
    console.warn(
      `Warming up Redis container loading, timeout of ${DOCKER_WARMUP_TIMEOUT}ms to account for Docker image pulls...`
    );
    let warmupContainer: StartedTestContainer;
    try {
      warmupContainer = await startRedisContainer();
      await warmupContainer.stop();
    } catch (err) {
      console.warn(`Failed to warmup Redis container: ${err}`);
    }
    warmupState.warmupCompleted = true;
  } else {
    while (!warmupState.warmupCompleted) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
};

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(
  `Instrumentation tests for the ${INSTRUMENTATION_NAME} package`,
  function (versionToTest) {
    let testApp: TestApp;
    let redisContainer: StartedTestContainer;

    beforeAll(async function () {
      reinstallPackages(TEST_APP_DIR);
      fs.mkdirSync(SPANS_DIR, { recursive: true });
      installPackage(TEST_APP_DIR, INSTRUMENTATION_NAME, versionToTest);

      await warmupContainer();
    }, DOCKER_WARMUP_TIMEOUT);

    beforeEach(async function () {
      redisContainer = await startRedisContainer();

      const host = redisContainer.getHost();
      const port = redisContainer.getMappedPort(DEFAULT_REDIS_PORT);

      console.info(`Redis container started on ${host}:${port}...`);
    }, 15_000);

    afterEach(async function () {
      if (testApp) {
        console.info('Killing test app...');
        await testApp.kill();
      } else {
        console.warn('Test app was not run.');
      }
      if (redisContainer) {
        console.info('Stopping Redis container...');
        await redisContainer.stop();
      } else {
        console.warn('Redis container was not started.');
      }
    });

    afterAll(function () {
      uninstallPackage(TEST_APP_DIR, INSTRUMENTATION_NAME, versionToTest);
    });

    itTest(
      {
        testName: `redis set and get: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/redis-set-and-get.${INSTRUMENTATION_NAME}@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });

        const key = 'test:set-and-get';
        const value = 'test-set-and-get-value';
        const host = redisContainer.getHost();
        const port = redisContainer.getMappedPort(DEFAULT_REDIS_PORT);
        await testApp.invokeGetPath(`/set?key=${key}&value=${value}&host=${host}&port=${port}`);

        await testApp.invokeGetPath(`/get?key=${key}&value=${value}&host=${host}&port=${port}`);

        const spans = await testApp.getFinalSpans(6);

        const redisSpans = filterRedisSpans(spans);
        expect(redisSpans).toHaveLength(4);

        let resourceAttributes = getExpectedResourceAttributes();

        const expectedConnectSpanName = `redis-connect`;
        const connectSpans = redisSpans.filter(
          (span) => span.name.indexOf(expectedConnectSpanName) == 0
        );
        expect(connectSpans).toHaveLength(2);
        for (const connectSpan of connectSpans) {
          expect(connectSpan).toMatchObject(
            getExpectedSpan({
              nameSpanAttr: expectedConnectSpanName,
              resourceAttributes,
              host,
            })
          );
        }

        const expectedSetSpanName = `redis-SET`;
        const setSpan = getSpanByName(redisSpans, expectedSetSpanName);
        expect(setSpan).toMatchObject(
          getExpectedSpan({
            nameSpanAttr: expectedSetSpanName,
            resourceAttributes,
            host,
            dbStatement: `SET ${key} ${value}`,
            responseBody: 'OK',
          })
        );

        const expectedGetSpanName = `redis-GET`;
        const getSpan = getSpanByName(redisSpans, expectedGetSpanName);
        expect(getSpan).toMatchObject(
          getExpectedSpan({
            nameSpanAttr: expectedGetSpanName,
            resourceAttributes,
            host,
            dbStatement: `GET ${key}`,
            responseBody: value,
          })
        );
      }
    );

    itTest(
      {
        testName: `redis hash: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/redis-hash.${INSTRUMENTATION_NAME}@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });

        const key = 'test:hash';
        const fieldA = 'test-field-a';
        const valueA = 'test-value-a';
        const fieldB = 'test-field-b';
        const valueB = 'test-value-b';
        const host = redisContainer.getHost();
        const port = redisContainer.getMappedPort(DEFAULT_REDIS_PORT);

        await testApp.invokeGetPath(
          `/hset?key=${key}&field=${fieldA}&value=${valueA}&host=${host}&port=${port}`
        );

        await testApp.invokeGetPath(
          `/hmset?key=${key}&fieldA=${fieldA}&valueA=${valueA}&fieldB=${fieldB}&valueB=${valueB}&host=${host}&port=${port}`
        );

        await testApp.invokeGetPath(`/hgetall?key=${key}&host=${host}&port=${port}`);

        const spans = await testApp.getFinalSpans(8);

        const redisSpans = filterRedisSpans(spans);
        expect(redisSpans).toHaveLength(6);

        let resourceAttributes = getExpectedResourceAttributes();

        const expectedConnectSpanName = `redis-connect`;
        const connectSpans = redisSpans.filter(
          (span) => span.name.indexOf(expectedConnectSpanName) == 0
        );
        expect(connectSpans).toHaveLength(3);
        for (const connectSpan of connectSpans) {
          expect(connectSpan).toMatchObject(
            getExpectedSpan({
              nameSpanAttr: expectedConnectSpanName,
              resourceAttributes,
              host,
            })
          );
        }

        const expectedSetSpanName = `redis-HSET`;
        const setSpans = redisSpans.filter((span) => span.name.indexOf(expectedSetSpanName) == 0);
        expect(setSpans).toHaveLength(2);
        expect(setSpans[0]).toMatchObject(
          getExpectedSpan({
            nameSpanAttr: expectedSetSpanName,
            resourceAttributes,
            host,
            dbStatement: `HSET ${key} ${fieldA} ${valueA}`,
            responseBody: 1,
          })
        );
        expect(setSpans[1]).toMatchObject(
          getExpectedSpan({
            nameSpanAttr: expectedSetSpanName,
            resourceAttributes,
            host,
            dbStatement: `HSET ${key} ${fieldA} ${valueA} ${fieldB} ${valueB}`,
            responseBody: 1,
          })
        );

        const expectedHGetAllSpanName = `redis-HGETALL`;
        const hGetAllSpan = getSpanByName(redisSpans, expectedHGetAllSpanName);
        expect(hGetAllSpan).toMatchObject(
          getExpectedSpan({
            nameSpanAttr: expectedHGetAllSpanName,
            resourceAttributes,
            host,
            dbStatement: `HGETALL ${key}`,
            responseBody: { [fieldA]: valueA, [fieldB]: valueB },
          })
        );
      }
    );

    itTest(
      {
        testName: `redis transaction: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/redis-transaction.${INSTRUMENTATION_NAME}@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });

        const key = 'test:transaction:set-and-get';
        const value = 'test-value';
        const host = redisContainer.getHost();
        const port = redisContainer.getMappedPort(DEFAULT_REDIS_PORT);

        await testApp.invokeGetPath(
          `/transaction-set-and-get?key=${key}&value=${value}&host=${host}&port=${port}`
        );

        const spans = await testApp.getFinalSpans(7);

        const redisSpans = filterRedisSpans(spans);
        expect(redisSpans).toHaveLength(6);

        let resourceAttributes = getExpectedResourceAttributes();

        const expectedConnectSpanName = `redis-connect`;
        const connectSpans = redisSpans.filter(
          (span) => span.name.indexOf(expectedConnectSpanName) == 0
        );
        expect(connectSpans).toHaveLength(1);
        for (const connectSpan of connectSpans) {
          expect(connectSpan).toMatchObject(
            getExpectedSpan({
              nameSpanAttr: expectedConnectSpanName,
              resourceAttributes,
              host,
            })
          );
        }

        const expectedSetSpanName = `redis-SET`;
        const setSpans = redisSpans.filter((span) => span.name.indexOf(expectedSetSpanName) == 0);
        expect(setSpans).toHaveLength(2);

        const expectedGetSpanName = `redis-GET`;
        const getSpans = redisSpans.filter((span) => span.name.indexOf(expectedGetSpanName) == 0);
        expect(getSpans).toHaveLength(3);
      }
    );
  } // describe function
);
