import 'jest-chain';
import fs from 'fs';
const rimraf = require("rimraf");

import { watchDir } from './helpers/fileListener';
import { callContainer, executeNpmScriptWithCallback } from './helpers/helpers';

describe('component compatibility tests for all supported versions of express', function () {
  let app;
  afterEach(() => {
    if (app) app.kill();
  });
  const supportedVersions =
    require('./node/package.json').lumigo.supportedDependencies['express'].versions;
  supportedVersions.forEach((expressVersion: string) => {
    it(`test happy flow on express@${expressVersion || 'latest'} / node@${
      process.version
    }`, async () => {
      jest.setTimeout(30000);
      console.log(`test happy flow on express@${expressVersion || 'latest'} / node@${
          process.version
      }`)
      if (expressVersion !== '') {
        rimraf.sync(`${__dirname}/node/node_modules/express`);
        fs.renameSync(
          `${__dirname}/node/node_modules/express@${expressVersion}`,
          `${__dirname}/node/node_modules/express`
        );
      }

      let resolver: (value: unknown) => void;
      const FILE_EXPORTER_FILE_NAME = `${__dirname}/node/spans-test-express${expressVersion}.json`;
      if (fs.existsSync(FILE_EXPORTER_FILE_NAME)) {
        fs.unlinkSync(FILE_EXPORTER_FILE_NAME);
      }
      const waitForThreeSpans = new Promise((resolve) => {
        resolver = resolve;
      });
      const foundThreeSpans = (resolver: (value: unknown) => void, value: any) => resolver(value);
      const spanCreatedHandler = (path: string) => {
        const allFileContents = fs.readFileSync(path, 'utf-8');
        const lines = allFileContents.split(/\r?\n/).filter((l) => l !== '');
        if (
          lines.length === 3 &&
          lines[0].startsWith('{"traceId"') &&
          lines[1].startsWith('{"traceId"') &&
          lines[2].startsWith('{"traceId"')
        ) {
          foundThreeSpans(resolver, lines);
        }
      };

      watchDir(`${__dirname}/node`, {
        onAddFileEvent: spanCreatedHandler,
        onChangeFileEvent: spanCreatedHandler,
      });

      // sleep before running the container to make sure the watcher picks up all the changes
      await new Promise((resolve) => setTimeout(resolve, 1000));

      app = await executeNpmScriptWithCallback(
        './test/component/node',
        (port: number) =>
          callContainer(port, 'invoke-requests', 'get', {
            a: '1',
          }),
        () => {},
        'start:injected',
        {
          LUMIGO_TRACER_TOKEN: 't_123321',
          LUMIGO_DEBUG_SPANDUMP: FILE_EXPORTER_FILE_NAME,
          OTEL_SERVICE_NAME: 'express-js',
          LUMIGO_DEBUG: true,
        }
      );
      // @ts-ignore
      const spans = (await waitForThreeSpans).map((text) => JSON.parse(text));
      expect(spans).toHaveLength(3);
      const serverSpan = spans.find((span) => span.kind === 0);
      const internalSpan = spans.find((span) => span.kind === 1);
      const clientSpan = spans.find((span) => span.kind === 2);
      expect(
        serverSpan.traceId === internalSpan.traceId && serverSpan.traceId === clientSpan.traceId
      ).toBeTruthy();
      expect(serverSpan).toMatchObject({
        traceId: expect.any(String),
        parentId: expect.any(String),
        name: 'GET /invoke-requests',
        id: expect.any(String),
        kind: 0,
        timestamp: expect.any(Number),
        duration: expect.any(Number),
        resource: {
          attributes: {
            'service.name': 'express-js',
            'telemetry.sdk.language': 'nodejs',
            'telemetry.sdk.name': 'opentelemetry',
            'telemetry.sdk.version': '1.1.1',
            framework: 'express',
            'process.environ': expect.stringMatching(/\{.*\}/),
            'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
            'process.pid': expect.any(Number),
            'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
            'process.runtime.name': 'nodejs',
            'process.executable.name': 'node',
          },
        },
        attributes: {
          'http.method': 'GET',
          'http.target': '/invoke-requests',
          'http.flavor': '1.1',
          'http.host': expect.stringMatching(/localhost:\d+/),
          'http.scheme': 'http',
          'net.peer.ip': '::ffff:127.0.0.1',
          'http.request.query': '{}',
          'http.request.headers': expect.stringMatching(/\{.*\}/),
          'http.response.headers': expect.stringMatching(/\{.*\}/),
          'http.response.body': expect.stringMatching(
            /\["animal","career","celebrity","dev","explicit","fashion","food","history","money","movie","music","political","religion","science","sport","travel"\]/
          ),
          'http.request.body': '{}',
          'http.route': '/invoke-requests',
          'express.route.full': '/invoke-requests',
          'express.route.configured': '/invoke-requests',
          'express.route.params': '{}',
          'http.status_code': 200,
        },
        status: {
          code: 1,
        },
        events: [],
      });

      expect(internalSpan).toMatchObject({
        traceId: expect.any(String),
        id: expect.any(String),
        timestamp: expect.any(Number),
        duration: expect.any(Number),
        name: 'HTTP GET',
        kind: 1,
        attributes: {
          'http.url': expect.stringMatching(/http:\/\/localhost:\d+\/invoke-requests/),
          'http.host': expect.stringMatching(/localhost:\d+/),
          'net.host.name': 'localhost',
          'http.method': 'GET',
          'http.target': '/invoke-requests',
          'http.user_agent': 'axios/0.21.4',
          'http.flavor': '1.1',
          'net.transport': 'ip_tcp',
          'net.host.ip': '::ffff:127.0.0.1',
          'net.host.port': expect.any(Number),
          'net.peer.ip': '::ffff:127.0.0.1',
          'net.peer.port': expect.any(Number),
          'http.status_code': 200,
          'http.status_text': 'OK',
          'http.route': '/invoke-requests',
        },
        status: {
          code: 0,
        },
        events: [],
      });
      expect(clientSpan).toMatchObject({
        traceId: expect.any(String),
        parentId: expect.any(String),
        id: expect.any(String),
        timestamp: expect.any(Number),
        duration: expect.any(Number),
        name: 'HTTPS GET',
        kind: 2,
        attributes: {
          'http.url': 'https://api.chucknorris.io/jokes/categories',
          'http.method': 'GET',
          'http.target': '/jokes/categories',
          'net.peer.name': 'api.chucknorris.io',
          'http.request.body': '""',
          'net.peer.ip': expect.stringMatching(
            /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$)){4}\b/
          ),
          'net.peer.port': 443,
          'http.host': 'api.chucknorris.io:443',
          'http.status_code': 200,
          'http.status_text': 'OK',
          'http.flavor': '1.1',
          'http.request.headers': expect.stringMatching(/\{.*\}/),
          'http.response.headers': expect.stringMatching(/\{.*\}/),
          'http.response.body': expect.stringMatching(
            /\["animal","career","celebrity","dev","explicit","fashion","food","history","money","movie","music","political","religion","science","sport","travel"\]/
          ),
        },
        status: {
          code: 0,
        },
        events: [],
      });
    });
  });
});
