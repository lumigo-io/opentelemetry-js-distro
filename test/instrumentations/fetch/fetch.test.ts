import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';

import { getSpanByKind } from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { TestServer } from '../../utils/test-server';

const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 20_000;

const expectedResourceAttributes = {
  attributes: {
    framework: 'node',
    'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
    'process.environ': expect.any(String),
    'process.executable.name': 'node',
    'process.pid': expect.any(Number),
    'process.runtime.name': 'nodejs',
    'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
    'service.name': 'fastify',
    'telemetry.sdk.language': 'nodejs',
    'telemetry.sdk.name': 'opentelemetry',
    'telemetry.sdk.version': expect.any(String),
  },
};

const isSupportedNodeVersion = () => {
  const [major] = process.versions.node.split('.').map(Number);
  return major >= 18;
};

describe(`Instrumentation tests for the fetch api`, function () {
  let testApp: TestApp;
  let testServer: TestServer;

  beforeAll(function () {
    fs.mkdirSync(SPANS_DIR, { recursive: true });
  });

  afterEach(async function () {
    try {
      await testApp.kill();
    } catch (err) {
      console.warn('Failed to kill test app', err);
    }
    try {
      await testServer.stop();
    } catch (err) {
      console.warn('Failed to stop test server', err);
    }
  });

  test(
    `fetch get json`,
    async function () {
      if (!isSupportedNodeVersion()) {
        console.warn('Skipping test - unsupported node version');
        return;
      }

      const exporterFile = `${SPANS_DIR}/get.json.fetch.json`;

      testApp = new TestApp(TEST_APP_DIR, 'fetch-app', exporterFile, {
        OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
      });

      testServer = new TestServer({
        '/': (req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ foo: 'bar' }));
        },
      });
      await testServer.start();

      await testApp.invokeGetPath(`/get-json?url=${testServer.getUri()}/`);

      const spans = await testApp.getFinalSpans(2);

      expect(getSpanByKind(spans, SpanKind.SERVER)).toMatchObject({
        traceId: expect.any(String),
        name: 'GET /basic',
        id: expect.any(String),
        kind: SpanKind.SERVER,
        timestamp: expect.any(Number),
        duration: expect.any(Number),
        resource: expectedResourceAttributes,
        attributes: {
          'http.method': 'GET',
          'http.target': '/basic',
          'http.host': expect.stringMatching(/localhost:\d+/),
          'http.scheme': 'http',
          'net.peer.ip': expect.any(String),
          'http.route': '/basic',
          'http.status_code': 200,
        },
        status: {
          code: SpanStatusCode.UNSET,
        },
        events: [],
      });

      expect(getSpanByKind(spans, SpanKind.INTERNAL)).toMatchObject({
        traceId: expect.any(String),
        parentId: expect.any(String),
        name: expect.stringMatching(/request handler - .+/),
        id: expect.any(String),
        kind: SpanKind.INTERNAL,
        timestamp: expect.any(Number),
        duration: expect.any(Number),
        resource: expectedResourceAttributes,
        attributes: {
          'http.request.query': '{}',
          'http.request.headers': expect.stringMatching(/\{.*\}/),
          // 'http.response.headers': expect.stringMatching(/\{.*\}/),
          // 'http.response.body': '"Hello world"',
          'http.route': '/basic',
        },
        status: {
          code: SpanStatusCode.UNSET,
        },
        events: [],
      });
    },
    TEST_TIMEOUT
  );
});
