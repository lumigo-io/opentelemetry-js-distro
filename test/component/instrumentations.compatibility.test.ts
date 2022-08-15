import 'jest-chain';
import fs from 'fs';
const rimraf = require('rimraf');
const semver = require('semver');
import { watchDir, stopWatching } from './helpers/fileListener';
import { waitForChildProcess } from './helpers/helpers';
import { instrumentationsVersionManager } from './helpers/InstrumentationsVersionManager';
import { InstrumentationTest } from './instrumentations/InstrumentationTest';
import {determineIfSpansAreReady} from "../testUtils/utils";

const SPANS_DIR = `/node/instrumentations/spans`;
describe("'All Instrumentation's tests'", () => {
  afterAll(() => {
    const versions = instrumentationsVersionManager.getInstrumantaionsVersions();
    Object.keys(versions).forEach((lib) => {
      // updated supported versions file
      const TESTED_VERSIONS_PATH = `${__dirname}/../../src/instrumentations/${lib}/tested_versions`;
      if (!fs.existsSync(TESTED_VERSIONS_PATH)) {
        fs.mkdirSync(TESTED_VERSIONS_PATH);
      }
      const versionStrings = versions[lib].unsupported
        .map((v) => `!${v}`)
        .concat(versions[lib].supported)
        .sort((v1, v2) => semver.compare(v1.replace('!', ''), v2.replace('!', '')))
        .join('\n');
      fs.writeFileSync(`${TESTED_VERSIONS_PATH}/${lib}`, versionStrings);
    });
  });

  const instrumentationsToTest = require('./node/instrumentations/package.json').lumigo.supportedDependencies;
  for (let dependency in instrumentationsToTest) {
    describe(`component compatibility tests for all supported versions of ${dependency}`, () => {
      let app;
      let resolver: (value: unknown) => void;
      const versionsToTest = require(`./node/instrumentations/${dependency}_versions.json`);
      let waitForDependencySpans;
      let dependencyTest: InstrumentationTest;
      afterEach(async () => {
        if (app) app.kill();
        rimraf.sync(`${__dirname}/node/instrumentations/spans`);
        await stopWatching();
        rimraf.sync(`${__dirname}/node/instrumentations/node_modules/${dependency}`);
      });

      beforeEach(async () => {
        dependencyTest = (await import(`./instrumentations/${dependency}`)).default;
        if (!fs.existsSync(`${__dirname}${SPANS_DIR}`)) {
          fs.mkdirSync(`${__dirname}${SPANS_DIR}`);
        }
        watchDir(`${__dirname}${SPANS_DIR}`, {
          onAddFileEvent: (path) => determineIfSpansAreReady(dependencyTest, path, resolver),
          onChangeFileEvent: (path) => determineIfSpansAreReady(dependencyTest, path, resolver),
        });
        waitForDependencySpans = new Promise((resolve) => {
          resolver = resolve;
        });
      });
      for (let version of versionsToTest) {
        const testMessage = `test happy flow on ${dependency}@${version} / node@${process.version}`;
        it(testMessage, async () => {
          try {
            console.log(testMessage);
            fs.renameSync(
              `${__dirname}/node/instrumentations/node_modules/${dependency}@${version}`,
              `${__dirname}/node/instrumentations/node_modules/${dependency}`
            );
            const FILE_EXPORTER_FILE_NAME = `${__dirname}${SPANS_DIR}/spans-test-${dependency}${version}.json`;
            app = await waitForChildProcess(
              `./test/component/node/instrumentations`,
              dependencyTest.onChildProcessReady,
              dependencyTest.isChildProcessReadyPredicate,
              `start:${dependency}:injected`,
              {
                LUMIGO_TRACER_TOKEN: 't_123321',
                LUMIGO_DEBUG_SPANDUMP: FILE_EXPORTER_FILE_NAME,
                OTEL_SERVICE_NAME: 'express-js',
                LUMIGO_DEBUG: true,
              },
              10000
            );

            const spans = (await waitForDependencySpans).map((text) => JSON.parse(text));
            dependencyTest.runTests(spans);
            instrumentationsVersionManager.addPackageSupportedVersion(dependency, version);
          } catch (e) {
            console.error(`${dependency}@${version} / node@${process.version} failed!`, e);
            instrumentationsVersionManager.addPackageUnsupportedVersion(dependency, version);
            throw e;
          }
        },20000);
      }
    });
  }
});
