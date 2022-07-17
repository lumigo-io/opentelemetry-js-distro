import 'jest-chain';
import fs from 'fs';
const rimraf = require('rimraf');
const semver = require('semver');
import { watchDir } from './helpers/fileListener';
import { callContainer, executeNpmScriptWithCallback } from './helpers/helpers';
import { instrumentationsVersionManager } from './helpers/InstrumentationsVersionManager';

describe("'All Instrumentation's tests'", () => {
  const spansResolvers = {
    express: (path: string, resolver) => {
      const allFileContents = fs.readFileSync(path, 'utf-8');
      const lines = allFileContents.split(/\r?\n/).filter((l) => l !== '');
      if (
        lines.length === 3 &&
        lines[0].startsWith('{"traceId"') &&
        lines[1].startsWith('{"traceId"') &&
        lines[2].startsWith('{"traceId"')
      ) {
        resolver(lines);
      }
    },
  };

  const tests = {
    express: (spans: any[]) => {
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
            'lumigo.distro.version': expect.any(String),
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
    },
  };

  afterAll(() => {
    const versions = instrumentationsVersionManager.getInstrumantaionsVersions();
    Object.keys(versions).forEach((lib) => {
      // updated supported versions file
      if (!fs.existsSync(`${__dirname}/../../instrumentations/${lib}/tested_versions`)) {
        fs.mkdirSync(`${__dirname}/../../instrumentations/${lib}/tested_versions`);
      }
      const versionStrings = versions[lib].unsupported
        .map((v) => `!${v}`)
        .concat(versions[lib].supported)
        .sort((v1, v2) => semver.compare(v1.replace('!', ''), v2.replace('!', '')))
        .toString()
        .replace(/,/g, '\n');
      fs.writeFileSync(
        `${__dirname}/../../instrumentations/${lib}/tested_versions/${lib}`,
        versionStrings + '\n'
      );
    });
  });

  const instrumentationsToTest = require('./node/package.json').lumigo.supportedDependencies;
  for (let dependency in instrumentationsToTest) {
    describe(`component compatibility tests for all supported versions of ${dependency}`, async function () {
      let app;
      let watcher;
      let lastTest = {
        failed: true,
        version: '',
      };
      let resolver: (value: unknown) => void;
      const versionsToTest =
        require('./node/package.json').lumigo.supportedDependencies[dependency].versions;
      let waitForDependencySpans;

      afterEach(async () => {
        if (app) app.kill();
        rimraf.sync(`${__dirname}/node/spans`);
        await watcher.close();
        if (lastTest.failed === true) {
          instrumentationsVersionManager.addPackageUnsupportedVersion(dependency, lastTest.version);
        } else {
          instrumentationsVersionManager.addPackageSupportedVersion(dependency, lastTest.version);
        }
        rimraf.sync(`${__dirname}/node/node_modules/${dependency}`);
      });

      beforeEach(() => {
        lastTest = {
          failed: true,
          version: undefined,
        };
        if (!fs.existsSync(`${__dirname}/node/spans`)) {
          fs.mkdirSync(`${__dirname}/node/spans`);
        }
        watcher = watchDir(`${__dirname}/node/spans`, {
          onAddFileEvent: (path) => spansResolvers[dependency](path, resolver),
          onChangeFileEvent: (path) => spansResolvers[dependency](path, resolver),
        });
        waitForDependencySpans = new Promise((resolve) => {
          resolver = resolve;
        });
      });
      for (let version of versionsToTest) {
        it(`test happy flow on ${dependency}@${version} / node@${process.version}`, async () => {
          jest.setTimeout(30000);
          lastTest.version = version;
          fs.renameSync(
            `${__dirname}/node/node_modules/${dependency}@${version}`,
            `${__dirname}/node/node_modules/${dependency}`
          );
          const FILE_EXPORTER_FILE_NAME = `${__dirname}/node/spans/spans-test-${dependency}${version}.json`;
          app = await executeNpmScriptWithCallback(
            './test/component/node',
            (port: number) =>
              callContainer(port, 'invoke-requests', 'get', {
                a: '1',
              }),
            () => {},
            `start:${dependency}:injected`,
            {
              LUMIGO_TRACER_TOKEN: 't_123321',
              LUMIGO_DEBUG_SPANDUMP: FILE_EXPORTER_FILE_NAME,
              OTEL_SERVICE_NAME: 'express-js',
              LUMIGO_DEBUG: true,
            }
          );
          // @ts-ignore
          const spans = (await waitForDependencySpans).map((text) => JSON.parse(text));
          tests[dependency](spans);
          lastTest.failed = false;
        });
      }
    });
  }
});
