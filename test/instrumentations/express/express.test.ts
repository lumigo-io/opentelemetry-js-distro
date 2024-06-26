import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';

import { SpanKind, SpanStatusCode } from '@opentelemetry/api';

import { itTest } from '../../integration/setup';
import {getSpanByKind, getSpansByKind} from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';

const INSTRUMENTATION_NAME = `express`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 20_000;

const expectedResourceAttributes = {
  attributes: {
    'framework': expect.toBeOneOf(['node', 'express']),
    'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
    'process.environ': expect.any(String),
    'process.executable.name': 'node',
    'process.pid': expect.any(Number),
    'process.runtime.name': 'nodejs',
    'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
    'service.name': 'express',
    'telemetry.sdk.language': 'nodejs',
    'telemetry.sdk.name': 'opentelemetry',
    'telemetry.sdk.version': expect.any(String),
  },
};

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(
  'Instrumentation tests for the express package',
  function (versionToTest) {
    let testApp: TestApp;

    beforeAll(function () {
      reinstallPackages({ appDir: TEST_APP_DIR });
      fs.mkdirSync(SPANS_DIR, { recursive: true });
      installPackage({
        appDir: TEST_APP_DIR,
        packageName: INSTRUMENTATION_NAME,
        packageVersion: versionToTest,
      });
    });

    afterEach(async function () {
      try {
        await testApp.kill();
      } catch (err) {
        console.warn('Failed to kill test app', err);
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
        testName: `basics: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/basics.express@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, { spanDumpPath: exporterFile, env: {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        }});

        await testApp.invokeGetPath('/basic');

        const spans = await testApp.getFinalSpans(2);

        // expect(spans, `More than 1 span! ${JSON.stringify(spans)}`).toHaveLength(1); // See #174
        expect(getSpanByKind(spans, SpanKind.INTERNAL)).toMatchObject({
          traceId: expect.any(String),
          parentId: expect.any(String),
          name: 'GET /basic',
          id: expect.any(String),
          kind: SpanKind.INTERNAL,
          timestamp: expect.any(Number),
          duration: expect.any(Number),
          resource: expectedResourceAttributes,
          attributes: {
            'http.method': 'GET',
            'http.target': '/basic',
            'http.flavor': '1.1',
            'http.host': expect.stringMatching(/localhost:\d+/),
            'http.scheme': 'http',
            'net.peer.ip': expect.any(String),
            'http.request.query': '{}',
            'http.request.headers': expect.stringMatching(/\{.*}/),
            'http.response.headers': expect.stringMatching(/\{.*}/),
            'http.response.body': '"Hello world"',
            'http.route': '/basic',
            'express.route.full': '/basic',
            'express.route.configured': '/basic',
            'express.route.params': '{}',
            'http.status_code': 200,
          },
          status: {
            code: SpanStatusCode.OK,
          },
          events: [],
        });
      }
    );

    itTest(
      {
        testName: `secret masking requests: ${versionToTest}`,
        packageName: 'express',
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/secret-masking-requests.express@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, { spanDumpPath: exporterFile, env: {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        }});

        await testApp.invokeGetPath('/test-scrubbing');

        const spans = await testApp.getFinalSpans(2);

        // expect(spans, `More than 1 span! ${JSON.stringify(spans)}`).toHaveLength(1); // See #174
        expect(getSpanByKind(spans, SpanKind.INTERNAL)).toMatchObject({
          traceId: expect.any(String),
          parentId: expect.any(String),
          name: 'GET /test-scrubbing',
          id: expect.any(String),
          kind: SpanKind.INTERNAL,
          timestamp: expect.any(Number),
          duration: expect.any(Number),
          resource: expectedResourceAttributes,
          attributes: {
            'http.flavor': '1.1',
            'http.scheme': 'http',
            'http.method': 'GET',
            'http.host': expect.stringMatching(/localhost:\d+/),
            'http.route': '/test-scrubbing',
            'http.target': '/test-scrubbing',
            'http.request.headers': expect.stringMatching(/\{.*}/),
            'http.request.query': '{}',
            'http.response.body': expect.jsonMatching({ Authorization: '****' }),
            'http.response.headers': expect.stringMatching(/\{.*}/),
            'http.status_code': 200,
            'express.route.full': '/test-scrubbing',
            'express.route.configured': '/test-scrubbing',
            'express.route.params': '{}',
          },
          status: {
            code: SpanStatusCode.OK,
          },
          events: [],
        });
      }
    );

    itTest(
      {
        testName: `secret masking requests - complete redaction: ${versionToTest}`,
        packageName: 'express',
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/secret-masking-requests-complete-redaction.express@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, { spanDumpPath: exporterFile, env: {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
          LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_BODIES: 'all',
        }});

        await testApp.invokeGetPath('/test-scrubbing');

        const spans = await testApp.getFinalSpans(2);

        // expect(spans, `More than 1 span! ${JSON.stringify(spans)}`).toHaveLength(1); // See #174
        expect(getSpanByKind(spans, SpanKind.INTERNAL)).toMatchObject({
          traceId: expect.any(String),
          parentId: expect.any(String),
          name: 'GET /test-scrubbing',
          id: expect.any(String),
          kind: SpanKind.INTERNAL,
          timestamp: expect.any(Number),
          duration: expect.any(Number),
          resource: expectedResourceAttributes,
          attributes: {
            'http.flavor': '1.1',
            'http.scheme': 'http',
            'http.method': 'GET',
            'http.host': expect.stringMatching(/localhost:\d+/),
            'http.route': '/test-scrubbing',
            'http.target': '/test-scrubbing',
            'http.request.query': '{}',
            'http.request.headers': expect.stringMatching(/\{.*}/),
            'http.response.body': '"****"',
            'http.response.headers': expect.stringMatching(/\{.*}/),
            'http.status_code': 200,
            'express.route.full': '/test-scrubbing',
            'express.route.configured': '/test-scrubbing',
            'express.route.params': '{}',
          },
          status: {
            code: SpanStatusCode.OK,
          },
          events: [],
        });
      }
    );

    [
        {
            serverFilterEnvVar: '[".*will-not-match.*"]',
            clientFilterEnvVar: '[".*will-not-match.*"]',
            filterEnvVar: '[".*send-external-request.*"]',
            expectedSpanCount: 0,
            expectedClientSpanCount: 0,
            expectedServerSpanCount: 0,
        },
        {
            serverFilterEnvVar: '[".*send-external-request.*"]',
            clientFilterEnvVar: '[".*will-not-match.*"]',
            filterEnvVar: '[".*will-not-match.*"]',
            expectedSpanCount: 0,
            expectedClientSpanCount: 0,
            expectedServerSpanCount: 0,
        },
        {
            serverFilterEnvVar: '[".*will-not-match.*"]',
            clientFilterEnvVar: '[".*send-external-request.*"]',
            filterEnvVar: '[".*will-not-match.*"]',
            expectedSpanCount: 3,
            expectedClientSpanCount: 1,
            expectedServerSpanCount: 1,
        }
    ].forEach(({
                       serverFilterEnvVar,
                       clientFilterEnvVar,
                       filterEnvVar,
                       expectedSpanCount,
                       expectedClientSpanCount,
                       expectedServerSpanCount}, index) => {
      return itTest(
          {
            testName: `skip http endpoint by regex ${index}: ${versionToTest}`,
            packageName: 'express',
            version: versionToTest,
            timeout: TEST_TIMEOUT,
          },
          async function () {
            const exporterFile = `${SPANS_DIR}/skip-http-endpoint-${index}.express@${versionToTest}.json`;

            testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, { spanDumpPath: exporterFile, env: {
                LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX: filterEnvVar,
                LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX_SERVER: serverFilterEnvVar,
                LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX_CLIENT: clientFilterEnvVar,
            }});

            await testApp.invokeGetPath('/send-external-request');

            const spans = await testApp.getFinalSpans(expectedSpanCount);

            expect(spans).toHaveLength(expectedSpanCount);
            expect(getSpansByKind(spans, SpanKind.SERVER)).toHaveLength(expectedServerSpanCount);
            expect(getSpansByKind(spans, SpanKind.CLIENT)).toHaveLength(expectedClientSpanCount);
          }
      );
    });
  }
);
