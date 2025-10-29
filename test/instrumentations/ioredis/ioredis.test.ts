import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import {
  filterRedisSpans,
  getExpectedResourceAttributes,
  getExpectedSpan,
  getQuerySpans,
  hasExpectedClientConnectionSpans,
} from './ioredisTestUtils';

const DEFAULT_REDIS_PORT = 6379;
const DOCKER_WARMUP_TIMEOUT = 30_000;
const INSTRUMENTATION_NAME = `ioredis`;
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
      reinstallPackages({ appDir: TEST_APP_DIR });
      fs.mkdirSync(SPANS_DIR, { recursive: true });
      installPackage({
        appDir: TEST_APP_DIR,
        packageName: INSTRUMENTATION_NAME,
        packageVersion: versionToTest,
      });

      await warmupContainer();
    }, DOCKER_WARMUP_TIMEOUT);

    beforeEach(async function () {
      redisContainer = await startRedisContainer();

      const host = redisContainer.getHost();
      const port = redisContainer.getMappedPort(DEFAULT_REDIS_PORT);

      console.info(`Redis container started on ${host}:${port}...`);
    }, 15_000);

    afterEach(async function () {
      try {
        await testApp.kill();
      } catch (err) {
        console.warn('Failed to kill test app', err);
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

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, {
          spanDumpPath: exporterFile,
          env: { OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096', LUMIGO_DISABLE_IOREDIS_INSTRUMENTATION: 'true'}
        });

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

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, {
          spanDumpPath: exporterFile,
          env: { 
            OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
            LUMIGO_REDUCED_REDIS_INSTRUMENTATION: 'false'
          }
        });

        const key = 'test:set-and-get';
        const value = 'test-set-and-get-value';
        const host = redisContainer.getHost();
        const port = redisContainer.getMappedPort(DEFAULT_REDIS_PORT);
        await testApp.invokeGetPath(`/set?key=${key}&value=${value}&host=${host}&port=${port}`);

        await testApp.invokeGetPath(`/get?key=${key}&value=${value}&host=${host}&port=${port}`);

        const spans = await testApp.getFinalSpans(12);

        const redisSpans = filterRedisSpans(spans);
        expect(redisSpans).toHaveLength(10);

        let resourceAttributes = getExpectedResourceAttributes();

        const setQueryTraceId = redisSpans[0].traceId;
        const setTraceSpans = redisSpans.filter((span) => span.traceId === setQueryTraceId);
        expect(setTraceSpans).toHaveLength(5);
        expect(hasExpectedClientConnectionSpans(setTraceSpans)).toBeTruthy();
        const setTraceQuerySpans = getQuerySpans(setTraceSpans);
        expect(setTraceQuerySpans).toHaveLength(2);

        for (const setTraceQuerySpan of setTraceQuerySpans) {
          expect(setTraceQuerySpan).toMatchObject(
            getExpectedSpan({
              name: 'set',
              resourceAttributes,
              attributes: {
                'db.statement': JSON.stringify(`set ${key} ${value}`),
                'db.response.body': JSON.stringify('OK'),
              },
            })
          );
        }

        const getTraceSpans = redisSpans.filter((span) => span.traceId !== setQueryTraceId);
        expect(getTraceSpans).toHaveLength(5);
        expect(hasExpectedClientConnectionSpans(getTraceSpans)).toBeTruthy();
        const getTraceQuerySpans = getQuerySpans(getTraceSpans);
        expect(getTraceQuerySpans).toHaveLength(2);

        for (const getTraceQuerySpan of getTraceQuerySpans) {
          expect(getTraceQuerySpan).toMatchObject(
            getExpectedSpan({
              name: 'get',
              resourceAttributes,
              attributes: {
                'db.statement': JSON.stringify(`get ${key}`),
                'db.response.body': JSON.stringify(value),
              },
            })
          );
        }
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
          LUMIGO_REDUCED_REDIS_INSTRUMENTATION: 'false'
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

        const spans = await testApp.getFinalSpans(18);

        const redisSpans = filterRedisSpans(spans);
        expect(redisSpans).toHaveLength(15);

        let resourceAttributes = getExpectedResourceAttributes();

        const hSetQueryTraceId = redisSpans[0].traceId;
        const hSetTraceSpans = redisSpans.filter((span) => span.traceId === hSetQueryTraceId);
        expect(hSetTraceSpans).toHaveLength(5);
        expect(hasExpectedClientConnectionSpans(hSetTraceSpans)).toBeTruthy();
        const hSetTraceQuerySpans = getQuerySpans(hSetTraceSpans);
        expect(hSetTraceQuerySpans).toHaveLength(2);

        for (const hSetTraceQuerySpan of hSetTraceQuerySpans) {
          expect(hSetTraceQuerySpan).toMatchObject(
            getExpectedSpan({
              name: 'hset',
              resourceAttributes,
              attributes: {
                'db.statement': JSON.stringify(`hset ${key} ${fieldA} ${valueA}`),
                'db.response.body': JSON.stringify('1'),
              },
            })
          );
        }

        const hmSetQueryTraceId = redisSpans.filter((span) => span.traceId !== hSetQueryTraceId)[0]
          .traceId;
        const hmSetTraceSpans = redisSpans.filter((span) => span.traceId === hmSetQueryTraceId);
        expect(hmSetTraceSpans).toHaveLength(5);
        expect(hasExpectedClientConnectionSpans(hmSetTraceSpans)).toBeTruthy();
        const hmSetTraceQuerySpans = getQuerySpans(hmSetTraceSpans);
        expect(hmSetTraceQuerySpans).toHaveLength(2);

        for (const hmSetTraceQuerySpan of hmSetTraceQuerySpans) {
          expect(hmSetTraceQuerySpan).toMatchObject(
            getExpectedSpan({
              name: 'hmset',
              resourceAttributes,
              attributes: {
                'db.statement': JSON.stringify(
                  `hmset ${key} ${fieldA} ${valueA} ${fieldB} ${valueB}`
                ),
                'db.response.body': JSON.stringify('OK'),
              },
            })
          );
        }

        const hGetAllTraceSpans = redisSpans.filter(
          (span) => span.traceId !== hSetQueryTraceId && span.traceId !== hmSetQueryTraceId
        );
        expect(hGetAllTraceSpans).toHaveLength(5);
        expect(hasExpectedClientConnectionSpans(hGetAllTraceSpans)).toBeTruthy();
        const hGetAllTraceQuerySpans = getQuerySpans(hGetAllTraceSpans);
        expect(hGetAllTraceQuerySpans).toHaveLength(2);

        for (const hGetAllTraceQuerySpan of hGetAllTraceQuerySpans) {
          expect(hGetAllTraceQuerySpan).toMatchObject(
            getExpectedSpan({
              name: 'hgetall',
              resourceAttributes,
              attributes: {
                'db.statement': JSON.stringify(`hgetall ${key}`),
                'db.response.body': JSON.stringify([fieldA, valueA, fieldB, valueB].join(',')),
              },
            })
          );
        }
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
          LUMIGO_REDUCED_REDIS_INSTRUMENTATION: 'false'
        }});

        const key = 'test:transaction:set-and-get';
        const value = 'test-value';
        const host = redisContainer.getHost();
        const port = redisContainer.getMappedPort(DEFAULT_REDIS_PORT);

        await testApp.invokeGetPath(
          `/transaction-set-and-get?key=${key}&value=${value}&host=${host}&port=${port}`
        );

        const spans = await testApp.getFinalSpans(14);

        const redisSpans = filterRedisSpans(spans);
        expect(redisSpans).toHaveLength(13);

        expect(hasExpectedClientConnectionSpans(redisSpans)).toBeTruthy();
        const transactionQuerySpans = getQuerySpans(redisSpans);
        expect(transactionQuerySpans).toHaveLength(10);

        const setSpans = redisSpans.filter((span) => span.name.indexOf('set') == 0);
        expect(setSpans).toHaveLength(4);

        const getSpans = redisSpans.filter((span) => span.name.indexOf('get') == 0);
        expect(getSpans).toHaveLength(6);
      }
    );
  } // describe function
);
