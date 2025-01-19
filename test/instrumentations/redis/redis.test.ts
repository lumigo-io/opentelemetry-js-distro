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
const DEFAULT_STARTUP_TIMEOUT = 90_000; // includes time to install packages
const DEFAULT_WARMUP_TIMEOUT = 60_000;
const INSTRUMENTATION_NAME = `redis`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 600_000;

const startRedisContainer = async () => {
  return await new GenericContainer('redis:latest')
    .withExposedPorts(DEFAULT_REDIS_PORT)
    .withStartupTimeout(DEFAULT_WARMUP_TIMEOUT)
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
      `Warming up Redis container loading, timeout of ${DEFAULT_WARMUP_TIMEOUT}ms to account for Docker image pulls...`
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
      reinstallPackages({ appDir: TEST_APP_DIR });
      fs.mkdirSync(SPANS_DIR, { recursive: true });
      installPackage({
        appDir: TEST_APP_DIR,
        packageName: INSTRUMENTATION_NAME,
        packageVersion: versionToTest,
      });

      await warmupContainer();
    }, DEFAULT_WARMUP_TIMEOUT);

    beforeEach(async function () {
      redisContainer = await startRedisContainer();

      const host = redisContainer.getHost();
      const port = redisContainer.getMappedPort(DEFAULT_REDIS_PORT);

      console.info(`Redis container started on ${host}:${port}...`);
    }, DEFAULT_STARTUP_TIMEOUT);

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
      uninstallPackage({
        appDir: TEST_APP_DIR,
        packageName: INSTRUMENTATION_NAME,
        packageVersion: versionToTest,
      });
    });

    itTest(
      {
        testName: `${INSTRUMENTATION_NAME} disable works: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}.disable-works@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, { spanDumpPath: exporterFile, env: {
            OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
            LUMIGO_DISABLE_REDIS_INSTRUMENTATION: 'true',
          }});

        const key = 'test:set-and-get';
        const value = 'test-set-and-get-value';
        const host = redisContainer.getHost();
        const port = redisContainer.getMappedPort(DEFAULT_REDIS_PORT);
        await testApp.invokeGetPath(`/set?key=${key}&value=${value}&host=${host}&port=${port}`);

        await testApp.invokeGetPath(`/get?key=${key}&value=${value}&host=${host}&port=${port}`);

        const spans = await testApp.getFinalSpans(2);

        const redisSpans = filterRedisSpans(spans);
        expect(redisSpans).toHaveLength(0);
      }
    );

    itTest(
      {
        testName: `${INSTRUMENTATION_NAME} set and get: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}.set-and-get@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, { spanDumpPath: exporterFile, env: {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        }});

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
        testName: `${INSTRUMENTATION_NAME} hash: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}.hash@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, { spanDumpPath: exporterFile, env: {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        }});

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
        testName: `${INSTRUMENTATION_NAME} transaction: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}.transaction@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, { spanDumpPath: exporterFile, env: {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        }});

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

        const setSpans = redisSpans.filter((span) => span.name.indexOf('redis-SET') == 0);
        expect(setSpans).toHaveLength(2);

        const getSpans = redisSpans.filter((span) => span.name.indexOf('redis-GET') == 0);
        expect(getSpans).toHaveLength(3);
      }
    );

    itTest(
      {
        testName: `${INSTRUMENTATION_NAME} filter INFO works: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}.filter-info-works@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, { spanDumpPath: exporterFile, env: {
            OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
          }});

        const host = redisContainer.getHost();
        const port = redisContainer.getMappedPort(DEFAULT_REDIS_PORT);
        await testApp.invokeGetPath(`/info?&host=${host}&port=${port}`);

        const spans = await testApp.getFinalSpans(2);

        const redisSpans = filterRedisSpans(spans);
        // redis connection span only expected
        expect(redisSpans).toHaveLength(1);
      }
    );

    itTest(
      {
        testName: `${INSTRUMENTATION_NAME} filter INFO disabled works: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}.filter-info-disabled-works@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, { spanDumpPath: exporterFile, env: {
            OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
            LUMIGO_REDUCED_REDIS_INSTRUMENTATION: 'false',
          }});

        const host = redisContainer.getHost();
        const port = redisContainer.getMappedPort(DEFAULT_REDIS_PORT);
        await testApp.invokeGetPath(`/info?&host=${host}&port=${port}`);

        const spans = await testApp.getFinalSpans(3);

        const redisSpans = filterRedisSpans(spans);
        // redis connection span + redis INFO span expected
        expect(redisSpans).toHaveLength(2);
        expect(getSpanByName(redisSpans, 'redis-INFO')).toBeDefined();
      }
    );

  } // describe function
);
