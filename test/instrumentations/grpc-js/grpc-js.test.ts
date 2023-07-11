import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';

import { SpanKind } from '@opentelemetry/api';

import { itTest } from '../../integration/setup';
import { getSpanByKind, readSpanDump } from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { sleep } from '../../utils/time';

const DEFAULT_GRPC_PORT = 50051;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 20_000;
const INSTRUMENTATION_NAME = `grpc-js`;

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

describe.each(['1.8.17'])(
  //versionsToTest('grpc-js', '@grpc/grpc-js'))(
  'Instrumentation tests for the @grpc/grpc-js package',
  function (versionToTest) {
    let testApp: TestApp;
    let testValidatorApp: TestApp;

    beforeAll(function () {
      reinstallPackages(TEST_APP_DIR);
      fs.mkdirSync(SPANS_DIR, { recursive: true });
      installPackage(TEST_APP_DIR, 'grpc-js', versionToTest);
    });

    afterEach(async function () {
      console.info('Killing test app...');
      await testApp?.kill();
      await testValidatorApp?.kill();
    });

    afterAll(function () {
      uninstallPackage(TEST_APP_DIR, '@grpc/grpc-js', versionToTest);
    });

    itTest(
      {
        testName: `roundtrip unary/unary: ${versionToTest}`,
        packageName: '@grpc/grpc-js',
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/server-roundtrip-unary-unary-grpc-js@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });

        const grpcPort = DEFAULT_GRPC_PORT;

        await testApp.invokeGetPath(`/start-server?port=${grpcPort}`);

        const greetingName = 'Siri';

        await testApp.invokeGetPath(
          `/make-unary-unary-request?port=${grpcPort}&name=${greetingName}`
        );

        let spans = await testApp.invokeGetPathAndRetrieveSpanDump(`/stop-server`);

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
      }
    );

    itTest(
      {
        testName: `server-side unary/unary: ${versionToTest}`,
        packageName: '@grpc/grpc-js',
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/server-side-unary-unary-grpc-js@${versionToTest}.json`;
        const validatorExporterFile = `${SPANS_DIR}/validator-server-side-unary-unary-grpc-js@${versionToTest}.json`;

        const grpcPort = DEFAULT_GRPC_PORT;
        console.log(`setting gRPC port to ${grpcPort}...`);

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });
        await testApp.waitUntilReady();

        await testApp.invokeGetPath(`/start-server?port=${grpcPort}`);

        testValidatorApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, validatorExporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });
        await testValidatorApp.waitUntilReady();

        const greetingName = 'Siri';

        await testValidatorApp.invokeGetPath(
          `/make-unary-unary-request?port=${grpcPort}&name=${greetingName}`
        );

        let spans = await testApp.invokeGetPathAndRetrieveSpanDump(`/stop-server`);

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
      }
    );

    itTest(
      {
        testName: `roundtrip unary/stream: ${versionToTest}`,
        packageName: '@grpc/grpc-js',
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/server-roundtrip-unary-stream-grpc-js@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });

        const grpcPort = DEFAULT_GRPC_PORT;

        await testApp.invokeGetPath(`/start-server?port=${grpcPort}`);

        const greetingName = 'Siri';

        await testApp.invokeGetPath(
          `/make-unary-stream-request?port=${grpcPort}&name=${greetingName}`
        );

        let spans = await testApp.invokeGetPathAndRetrieveSpanDump(`/stop-server`);

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
      }
    );

    itTest(
      {
        testName: `roundtrip stream/unary: ${versionToTest}`,
        packageName: '@grpc/grpc-js',
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/server-roundtrip-stream-unary-grpc-js@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });

        const grpcPort = DEFAULT_GRPC_PORT;

        await testApp.invokeGetPath(`/start-server?port=${grpcPort}`);

        const greetingNames = ['Siri', 'Alexa', 'Cortana'];
        let greetingNamesQueryString = '';
        for (let name of greetingNames) {
          greetingNamesQueryString += `&name=${name}`;
        }

        await testApp.invokeGetPath(
          `/make-stream-unary-request?port=${grpcPort}${greetingNamesQueryString}`
        );

        let spans = await testApp.invokeGetPathAndRetrieveSpanDump(`/stop-server`);

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
      }
    );

    itTest(
      {
        testName: `roundtrip stream/stream: ${versionToTest}`,
        packageName: '@grpc/grpc-js',
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/server-roundtrip-stream-stream-grpc-js@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });

        const grpcPort = DEFAULT_GRPC_PORT;

        await testApp.invokeGetPath(`/start-server?port=${grpcPort}`);

        const greetingNames = ['Siri', 'Alexa', 'Cortana'];
        let greetingNamesQueryString = '';
        for (let name of greetingNames) {
          greetingNamesQueryString += `&name=${name}`;
        }

        await testApp.invokeGetPath(
          `/make-stream-stream-request?port=${grpcPort}${greetingNamesQueryString}`
        );

        let spans = await testApp.invokeGetPathAndRetrieveSpanDump(`/stop-server`);

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
      }
    );
  }
);
