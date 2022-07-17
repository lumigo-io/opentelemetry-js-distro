import 'jest-chain';
import fs from 'fs';
const rimraf = require('rimraf');
const semver = require('semver');
import { watchDir } from './helpers/fileListener';
import { executeNpmScriptWithCallback } from './helpers/helpers';
import { instrumentationsVersionManager } from './helpers/InstrumentationsVersionManager';
import { InstrumentationTest } from './instrumentations/InstrumentationTest';

describe("'All Instrumentation's tests'", () => {
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
      let resolver: (value: unknown) => void;
      const versionsToTest =
        require('./node/package.json').lumigo.supportedDependencies[dependency].versions;
      let waitForDependencySpans;
      let dependencyTest: InstrumentationTest;
      afterEach(async () => {
        if (app) app.kill();
        rimraf.sync(`${__dirname}/node/spans`);
        await watcher.close();
        rimraf.sync(`${__dirname}/node/node_modules/${dependency}`);
      });

      beforeEach(async () => {
        dependencyTest = (await import(`./instrumentations/${dependency}`)).default;
        if (!fs.existsSync(`${__dirname}/node/spans`)) {
          fs.mkdirSync(`${__dirname}/node/spans`);
        }
        watcher = watchDir(`${__dirname}/node/spans`, {
          onAddFileEvent: (path) => dependencyTest.resolveSpans(path, resolver),
          onChangeFileEvent: (path) => dependencyTest.resolveSpans(path, resolver),
        });
        waitForDependencySpans = new Promise((resolve) => {
          resolver = resolve;
        });
      });
      for (let version of versionsToTest) {
        it(`test happy flow on ${dependency}@${version} / node@${process.version}`, async () => {
          try {
            jest.setTimeout(30000);
            fs.renameSync(
              `${__dirname}/node/node_modules/${dependency}@${version}`,
              `${__dirname}/node/node_modules/${dependency}`
            );
            const FILE_EXPORTER_FILE_NAME = `${__dirname}/node/spans/spans-test-${dependency}${version}.json`;
            app = await executeNpmScriptWithCallback(
              './test/component/node',
              dependencyTest.onChildProcessReady,
              dependencyTest.onChildProcessData,
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
            dependencyTest.runTests(spans);
            instrumentationsVersionManager.addPackageSupportedVersion(dependency, version);
          } catch (e) {
            instrumentationsVersionManager.addPackageUnsupportedVersion(dependency, version);
            throw e;
          }
        });
      }
    });
  }
});
