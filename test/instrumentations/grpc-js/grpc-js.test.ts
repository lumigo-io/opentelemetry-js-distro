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

    const checkSpans = async (exporterFile: string, method: string, requestPayload: string, responsePayload: string) => {
        let spans = await testApp.invokeGetPathAndRetrieveSpanDump(`/stop-server`);

        /*
         * TODO: HORRIBLE WORKAROUND: The internal span we are looking for seems to be closed LATER than
         * the Server span, so we must busy-poll.
         */
        while (spans.length < 2) {
          await sleep(1_000);
          spans = readSpanDump(exporterFile);
        }
        spans = spans.filter(s => s.name === `grpc.helloworld.Greeter/${method}`);

        const serverSpan = getSpanByKind(spans, SpanKind.SERVER);
        expect(serverSpan.attributes["rpc.system"]).toEqual("grpc");
        expect(serverSpan.attributes["rpc.service"]).toEqual("helloworld.Greeter");
        expect(serverSpan.attributes["rpc.method"]).toEqual(method);

        const clientSpan = getSpanByKind(spans, SpanKind.CLIENT);
        expect(clientSpan.attributes["rpc.system"]).toEqual("grpc");
        expect(clientSpan.attributes["rpc.service"]).toEqual("helloworld.Greeter");
        expect(clientSpan.attributes["rpc.method"]).toEqual(method);

        expect(clientSpan["traceId"]).toEqual(serverSpan["traceId"]);
        expect(clientSpan["spanId"]).toEqual(serverSpan["parentSpanId"]);

        // TODO - add payload
        // expect(serverSpan.attributes["rpc.request.payload"]).toEqual(requestPayload);
        // expect(clientSpan.attributes["rpc.request.payload"]).toEqual(requestPayload);
        // expect(serverSpan.attributes["rpc.response.payload"]).toEqual(responsePayload);
        // expect(clientSpan.attributes["rpc.response.payload"]).toEqual(responsePayload);
    }

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

        await checkSpans(exporterFile, "SayHelloUnaryUnary", "", "");
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
        await checkSpans(exporterFile, "SayHelloUnaryStream", "", "");
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
        await checkSpans(exporterFile, "SayHelloStreamUnary", "", "");
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
        await checkSpans(exporterFile, "SayHelloStreamStream", "", "");
      }
    );
  }
);
