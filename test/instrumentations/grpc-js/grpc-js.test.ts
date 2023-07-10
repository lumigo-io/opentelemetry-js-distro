import { ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';

import { SpanKind } from '@opentelemetry/api';

import { itTest } from '../../integration/setup';
import { getSpanByKind, readSpanDump } from '../../utils/spans';
import { invokeHttp, invokeHttpAndGetSpanDump, startTestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { sleep } from '../../utils/time';

const DEFAULT_GRPC_PORT = 50051;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APPS = {
  CLIENT: join(__dirname, 'client-app'),
  ROUNDTRIP: join(__dirname, 'roundtrip-app'),
  SERVER: join(__dirname, 'server-app'),
};
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
    let testApp: ChildProcessWithoutNullStreams;

    beforeAll(function () {
      for (let app in TEST_APPS) {
        reinstallPackages(TEST_APPS[app]);
      }
      fs.mkdirSync(SPANS_DIR, { recursive: true });
      for (let app in TEST_APPS) {
        installPackage(TEST_APPS[app], 'grpc-js', versionToTest);
      }
    });

    afterEach(async function () {
      console.info('Killing test app...');
      if (testApp?.kill('SIGHUP')) {
        console.info('Waiting for test app to exit...');
        await sleep(200);
      } else {
        console.warn('Test app not found, nothing to kill.');
      }
    });

    afterAll(function () {
      for (let app in TEST_APPS) {
        uninstallPackage(TEST_APPS[app], '@grpc/grpc-js', versionToTest);
      }
    });

    itTest(
      {
        testName: `roundtrip basics: ${versionToTest}`,
        packageName: '@grpc/grpc-js',
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/server-roundtrip-grpc-js@${versionToTest}.json`;

        const { app, port } = await startTestApp(
          TEST_APPS.ROUNDTRIP,
          INSTRUMENTATION_NAME,
          exporterFile,
          {
            OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
          }
        );
        testApp = app;

        let url = `http://localhost:${port}/start-server?port=${DEFAULT_GRPC_PORT}`;
        console.error(`Making request to ${url} ...`);
        let response = await invokeHttp(url);

        expect(response.status).toBe(200);
        expect(response.data).toBe('OK');

        const greetingName = 'Siri';

        response = await invokeHttp(
          `http://localhost:${port}/make-client-request?port=${DEFAULT_GRPC_PORT}&name=${greetingName}`
        );

        let spans = await invokeHttpAndGetSpanDump(
          `http-get://localhost:${port}/stop-server`,
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
      }
    );
  }
);
