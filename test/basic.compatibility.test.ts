import fs from 'fs';
const rimraf = require('rimraf');
import { watchDir, stopWatching } from './helpers/fileListener';
import { waitForChildProcess } from './helpers/helpers';
import {determineIfSpansAreReady, getDirectories, waitAndRunSpansAssertions} from './testUtils/utils';
import { InstrumentationTest } from './instrumentationsTests/InstrumentationTest';

const integrations = getDirectories(`${__dirname}/component`);
for (let integration of integrations) {
  describe(`Testing component with ${integration}`, () => {
    let dependencyTest: InstrumentationTest;
    const SPANS_DIR = `${__dirname}/component/${integration}/spans`;
    let app;
    let resolver: (value: unknown) => void;
    let waitForDependencySpans;
    const cleanExit = function () {
      {
        if (app) app.kill('SIGINT');
        process.exit();
      }
    };
    process.on('SIGINT', cleanExit); // catch ctrl-c
    process.on('SIGTERM', cleanExit); // catch kill

    beforeEach(async () => {
      dependencyTest = (await import(`./instrumentationsTests/${integration}`)).default;
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

    afterEach(async () => {
      if (app) app.kill('SIGINT');
      rimraf.sync(SPANS_DIR);
      await stopWatching();
    });

    it('should set framework to component', async () => {
      const FILE_EXPORTER_FILE_NAME = `${SPANS_DIR}/spans-test-nodejs.json`;
      app = await waitForChildProcess(
        `./test/component/${integration}`,
        dependencyTest.onChildProcessReady,
        dependencyTest.isChildProcessReadyPredicate,
        `start:nodejs:injected`,
        {
          LUMIGO_TRACER_TOKEN: 't_123321',
          LUMIGO_DEBUG_SPANDUMP: FILE_EXPORTER_FILE_NAME,
          OTEL_SERVICE_NAME: 'http-js',
          LUMIGO_DEBUG: true,
        },
        10000
      );
      await waitAndRunSpansAssertions(waitForDependencySpans, dependencyTest, 5000);
    }, 20000);
  });
}
