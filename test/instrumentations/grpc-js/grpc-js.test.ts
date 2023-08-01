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
import {versionsToTest} from "../../utils/versions";

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

describe.each(versionsToTest('grpc', 'grpc'))(
  'Instrumentation tests for the @grpc/grpc-js package',
  function (versionToTest) {
    let testApp: TestApp;
    let testValidatorApp: TestApp;

    beforeAll(function () {
      reinstallPackages(TEST_APP_DIR);
      fs.mkdirSync(SPANS_DIR, { recursive: true });
      installPackage(TEST_APP_DIR, '@grpc/grpc-js', versionToTest);
    });

    afterEach(async function () {
      console.info('Killing test app...');
      await testApp?.kill();
      await testValidatorApp?.kill();
    });

    afterAll(function () {
      uninstallPackage(TEST_APP_DIR, '@grpc/grpc-js', versionToTest);
    });

    const checkSpans = async (exporterFile: string, method: string) => {
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

        return [
            serverSpan.attributes["rpc.request.payload"],
            clientSpan.attributes["rpc.request.payload"],
            serverSpan.attributes["rpc.response.payload"],
            clientSpan.attributes["rpc.response.payload"]
        ];
    }

    itTest(
      {
        testName: `roundtrip unary/unary: ${versionToTest}`,
        packageName: 'grpc',
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

        const [serverRequest, clientRequest, serverResponse, clientResponse] = await checkSpans(exporterFile, "SayHelloUnaryUnary");
        expect(serverRequest).toEqual('{"name":"Siri"}');
        expect(clientRequest).toEqual('{"name":"Siri"}');
        expect(serverResponse).toEqual('{"message":"Hello Siri"}');
        expect(clientResponse).toEqual('{"message":"Hello Siri"}');
      }
    );

    itTest(
      {
        testName: `roundtrip unary/stream: ${versionToTest}`,
        packageName: 'grpc',
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

        const [serverRequest, clientRequest, serverResponse, clientResponse] = await checkSpans(exporterFile, "SayHelloUnaryStream");
        expect(serverRequest).toEqual('{"name":"Siri"}');
        expect(clientRequest).toEqual('{"name":"Siri"}');
        // TODO: collect the response stream from the server - RD-11068
        // expect(serverResponse).toEqual('{"message":"Hello Siri 0"}{"message":"Hello Siri 1"}{"message":"Hello Siri 2"}{"message":"Hello Siri 3"}{"message":"Hello Siri 4"}');
        expect(clientResponse).toEqual('{"message":"Hello Siri 0"}{"message":"Hello Siri 1"}{"message":"Hello Siri 2"}{"message":"Hello Siri 3"}{"message":"Hello Siri 4"}');
      }
    );

    itTest(
      {
        testName: `roundtrip stream/unary: ${versionToTest}`,
        packageName: 'grpc',
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

        const [serverRequest, clientRequest, serverResponse, clientResponse] = await checkSpans(exporterFile, "SayHelloStreamUnary");
        expect(serverRequest).toEqual('{"name":"0"}{"name":"1"}{"name":"2"}');
        // TODO: collect the request stream from the client - RD-11068
        // expect(clientRequest).toEqual('{"name":"0"}{"name":"1"}{"name":"2"}');
        expect(serverResponse).toEqual('{"message":"Hello 0, 1, 2"}');
        expect(clientResponse).toEqual('{"message":"Hello 0, 1, 2"}');
      }
    );

    itTest(
      {
        testName: `roundtrip stream/stream: ${versionToTest}`,
        packageName: 'grpc',
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

        const [serverRequest, clientRequest, serverResponse, clientResponse] = await checkSpans(exporterFile, "SayHelloStreamStream");
        expect(serverRequest).toEqual('{"name":"0"}{"name":"1"}{"name":"2"}');
        // TODO: collect the request stream from the client - RD-11068
        // expect(clientRequest).toEqual('{"name":"0"}{"name":"1"}{"name":"2"}');
        // TODO: collect the response stream from the server - RD-11068
        // expect(serverResponse).toEqual('{"message":"Hello 0 1"}{"message":"Hello 1 2"}{"message":"Hello 2 3"}');
        expect(clientResponse).toEqual('{"message":"Hello 0 1"}{"message":"Hello 1 2"}{"message":"Hello 2 3"}');
      }
    );
  }
);
