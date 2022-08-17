import fs from 'fs';
const rimraf = require('rimraf');
const semver = require('semver');
import { watchDir, stopWatching } from './helpers/fileListener';
import { waitForChildProcess } from './helpers/helpers';
import { instrumentationsVersionManager } from './helpers/InstrumentationsVersionManager';
import { InstrumentationTest } from './integration/InstrumentationTest';
import {determineIfSpansAreReady, getDirectories, waitAndRunSpansAssertions} from "./testUtils/utils";

describe("'All Instrumentation's tests'", () => {
  afterAll(() => {
    const versions = instrumentationsVersionManager.getInstrumantaionsVersions();
    Object.keys(versions).forEach((lib) => {
      // updated supported versions file
      const TESTED_VERSIONS_PATH = `${__dirname}/../src/instrumentations/${lib}/tested_versions`;
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

  const integrations = getDirectories(`${__dirname}/integration`)
  for (let integration of integrations) {
    const instrumentationsToTest = require(`./integration/${integration}/app/package.json`).lumigo.supportedDependencies;
    for (let dependency in instrumentationsToTest) {
      describe(`component compatibility tests for all supported versions of ${dependency}`, () => {
        const SPANS_DIR = `${__dirname}/integration/${integration}/app/spans`;
        let app;
        let resolver: (value: unknown) => void;
        const versionsToTest = require(`./integration/${integration}/app/${dependency}_versions.json`);
        let waitForDependencySpans;
        let dependencyTest: InstrumentationTest;
        afterEach(async () => {
          if (app) app.kill();
          rimraf.sync(SPANS_DIR);
          await stopWatching();
          rimraf.sync(`${__dirname}/integration/${integration}/app/node_modules/${dependency}`);
        });

        beforeEach(async () => {
          dependencyTest = (await import(`./integration/${integration}/${dependency}Test`)).default;
          if (!fs.existsSync(SPANS_DIR)) {
            fs.mkdirSync(SPANS_DIR);
          }
          watchDir(SPANS_DIR, {
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
                  `${__dirname}/integration/${integration}/app/node_modules/${dependency}@${version}`,
                  `${__dirname}/integration/${integration}/app/node_modules/${dependency}`
              );
              const FILE_EXPORTER_FILE_NAME = `${SPANS_DIR}/spans-test-${dependency}${version}.json`;
              app = await waitForChildProcess(
                  `./test/integration/${integration}/app`,
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

              await waitAndRunSpansAssertions(waitForDependencySpans, dependencyTest, 5000);
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
  }

});
