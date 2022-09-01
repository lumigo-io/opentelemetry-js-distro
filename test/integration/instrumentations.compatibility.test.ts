import fs from 'fs';
const rimraf = require('rimraf');
const semver = require('semver');
const kill  = require('tree-kill');
import { watchDir, stopWatching } from '../helpers/fileListener';
import { waitForChildProcess } from '../helpers/helpers';
import { instrumentationsVersionManager } from '../helpers/InstrumentationsVersionManager';
import { InstrumentationTest } from './integration/InstrumentationTest';
import {
  determineIfSpansAreReady,
  getDirectories,
  waitAndRunSpansAssertions,
} from '../testUtils/utils';

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

  const integrations = getDirectories(`${__dirname}`);
  for (let integration of integrations) {
    const tests = require(`./${integration}/${integration}Test`);
    let integrationTests: InstrumentationTest[] = tests[`${integration}InstrumentationTests`];

    const instrumentationsToTest = require(`./${integration}/app/package.json`).lumigo
      .supportedDependencies;
    for (let dependency in instrumentationsToTest) {
      describe(`component compatibility tests for all supported versions of ${dependency}`, () => {
        const SPANS_DIR = `${__dirname}/${integration}/spans`;

        let app;
        let resolver: (value: unknown) => void;
        const versionsToTest = require(`./${integration}/app/${dependency}_versions.json`);
        let waitForDependencySpans;
        const cleanExit = function () {
          {
            if (app) app.kill('SIGINT');
            process.exit();
          }
        };
        process.on('SIGINT', cleanExit); // catch ctrl-c
        process.on('SIGTERM', cleanExit); // catch kill

        beforeAll(() => {
          if (!fs.existsSync(SPANS_DIR)) {
            fs.mkdirSync(SPANS_DIR);
          }
        });

        afterEach(async () => {
          if (app) kill(app.pid);
          await stopWatching();
          rimraf.sync(`${__dirname}/${integration}/app/node_modules/${dependency}`);
        });

        beforeEach(async () => {
          waitForDependencySpans = new Promise((resolve) => {
            resolver = resolve;
          });
        });
        for (let version of versionsToTest) {
          const testMessage = `test happy flow on ${dependency}@${version} / node@${process.version}`;
          for (let integrationTest of integrationTests) {
            const testSupportedVersion = integrationTest.getSupportedVersion();
            if (testSupportedVersion && parseInt(version)!=testSupportedVersion){
              continue;
            }
            it(
              testMessage,
              async () => {
                try {
                  console.log(testMessage);
                  watchDir(SPANS_DIR, {
                    onAddFileEvent: (path) =>
                      determineIfSpansAreReady(integrationTest, path, resolver),
                    onChangeFileEvent: (path) =>
                      determineIfSpansAreReady(integrationTest, path, resolver),
                  });
                  fs.renameSync(
                    `${__dirname}/${integration}/app/node_modules/${dependency}@${version}`,
                    `${__dirname}/${integration}/app/node_modules/${dependency}`
                  );
                  const FILE_EXPORTER_FILE_NAME = `${SPANS_DIR}/spans-test-${dependency}${version}.json`;
                  app = await waitForChildProcess(
                    `./test/integration/${integration}/app`,
                    integrationTest.onChildProcessReady,
                    integrationTest.isChildProcessReadyPredicate,
                    `start:${dependency}:injected`,
                    {
                      LUMIGO_TRACER_TOKEN: 't_123321',
                      LUMIGO_DEBUG_SPANDUMP: FILE_EXPORTER_FILE_NAME,
                      OTEL_SERVICE_NAME: integration,
                      LUMIGO_DEBUG: true,
                      ...integrationTest.getEnvVars()
                    },
                    30000
                  );

                  await waitAndRunSpansAssertions(
                    waitForDependencySpans,
                    integrationTest,
                    10000,
                    version
                  );
                  instrumentationsVersionManager.addPackageSupportedVersion(dependency, version);
                } catch (e) {
                  console.error(`${dependency}@${version} / node@${process.version} failed!`, e);
                  instrumentationsVersionManager.addPackageUnsupportedVersion(dependency, version);
                  throw e;
                }
              },
              30000
            );
          }
        }
      });
    }
  }
});
