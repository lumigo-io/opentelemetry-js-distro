import { ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';

import { SpanKind } from '@opentelemetry/api';

import { getSpanByKind, readSpanDump } from '../../utils/spans';
import { invokeHttpAndGetSpanDump, startTestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { sleep } from '../../utils/time';
import { versionsToTest } from '../../utils/versions';

const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 20_000;
const INSTRUMENTATION_NAME = `express`;

const expectedResourceAttributes = {
  attributes: {
    framework: 'express',
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

// if the test is run locally, only test the earliest and latest versions
const allVersions = versionsToTest('express', 'express');
const versionsList = process.env['GITHUB_ACTIONS']?.length
  ? allVersions
  : [allVersions[0], allVersions[allVersions.length - 1]];

describe.each(versionsList)(
  'Instrumentation tests for the express package',
  function (versionToTest) {
    let testApp: ChildProcessWithoutNullStreams;

    beforeAll(function () {
      reinstallPackages(TEST_APP_DIR);
      fs.mkdirSync(SPANS_DIR, { recursive: true });
    });

    beforeEach(function () {
      installPackage(TEST_APP_DIR, 'express', versionToTest);
    });

    afterEach(async function () {
      console.info('killing test app...');
      if (testApp?.kill('SIGHUP')) {
        console.info('Waiting for test app to exit...');
        await sleep(200);
      } else {
        console.warn('Test app not found, nothing to kill.');
      }

      uninstallPackage(TEST_APP_DIR, 'express', versionToTest);
    });

    test(
      `basics: ${versionToTest}`,
      async function () {
        const exporterFile = `${SPANS_DIR}/basic-express@${versionToTest}.json`;

        const { app, port } = await startTestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });
        testApp = app;

        let spans = await invokeHttpAndGetSpanDump(
          `http-get://localhost:${port}/basic`,
          exporterFile
        );

        /*
         * TODO: HORRIBLE WORKAROUND: The internal span we are looking for seems to be closed LATER than
         * the Server span, so we must busy-poll.
         */
        while (spans.length < 2) {
          await sleep(1_000);
          spans = readSpanDump(exporterFile);
        }

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
            'http.request.headers': expect.stringMatching(/\{.*\}/),
            'http.response.headers': expect.stringMatching(/\{.*\}/),
            'http.response.body': '"Hello world"',
            'http.route': '/basic',
            'express.route.full': '/basic',
            'express.route.configured': '/basic',
            'express.route.params': '{}',
            'http.status_code': 200,
          },
          status: {
            code: 1,
          },
          events: [],
        });
      },
      TEST_TIMEOUT
    );

    test(
      `secret masking requests: ${versionToTest}`,
      async function () {
        const exporterFile = `${SPANS_DIR}/secret-masking-express@${versionToTest}.json`;

        const { app, port } = await startTestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });
        testApp = app;

        let spans = await invokeHttpAndGetSpanDump(
          `http-get://localhost:${port}/test-scrubbing`,
          exporterFile
        );

        /*
         * TODO: HORRIBLE WORKAROUND: The internal span we are looking for seems to be closed LATER than
         * the Server span, so we must busy-poll.
         */
        while (spans.length < 2) {
          await sleep(1_000);
          spans = readSpanDump(exporterFile);
        }

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
            'http.request.headers': expect.stringMatching(/\{.*\}/),
            'http.request.query': '{}',
            'http.response.body': expect.jsonMatching({ Authorization: '****' }),
            'http.response.headers': expect.stringMatching(/\{.*\}/),
            'http.status_code': 200,
            'express.route.full': '/test-scrubbing',
            'express.route.configured': '/test-scrubbing',
            'express.route.params': '{}',
          },
          status: {
            code: 1,
          },
          events: [],
        });
      },
      TEST_TIMEOUT
    );

    test(
      `secret masking requests - complete redaction: ${versionToTest}`,
      async function () {
        const exporterFile = `${SPANS_DIR}/secret-masking-express@${versionToTest}.json`;

        const { app, port } = await startTestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
          LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_BODIES: 'all',
        });
        testApp = app;

        let spans = await invokeHttpAndGetSpanDump(
          `http-get://localhost:${port}/test-scrubbing`,
          exporterFile
        );

        /*
         * TODO: HORRIBLE WORKAROUND: The internal span we are looking for seems to be closed LATER than
         * the Server span, so we must busy-poll.
         */
        while (spans.length < 2) {
          await sleep(1_000);
          spans = readSpanDump(exporterFile);
        }

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
            'http.request.headers': expect.stringMatching(/\{.*\}/),
            'http.response.body': '"****"',
            'http.response.headers': expect.stringMatching(/\{.*\}/),
            'http.status_code': 200,
            'express.route.full': '/test-scrubbing',
            'express.route.configured': '/test-scrubbing',
            'express.route.params': '{}',
          },
          status: {
            code: 1,
          },
          events: [],
        });
      },
      TEST_TIMEOUT
    );
  }
);
