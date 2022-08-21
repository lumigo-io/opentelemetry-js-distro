import fs from 'fs';
var kill  = require('tree-kill');


import { watchDir, stopWatching } from '../helpers/fileListener';
import { waitForChildProcess } from '../helpers/helpers';
import {determineIfSpansAreReady, getDirectories, waitAndRunSpansAssertions} from '../testUtils/utils';
import { InstrumentationTest } from '../helpers/InstrumentationTest';

const components = getDirectories(`${__dirname}`);
for (let component of components) {

  const tests = require(`./${component}/${component}Test`);
  let componentTests: InstrumentationTest[];
  componentTests = tests[`${component}ComponentTests`];

  describe(`Testing component with ${component}`, () => {

    const SPANS_DIR = `${__dirname}/${component}/spans`;
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

    beforeAll(async ()=>{
      if (!fs.existsSync(SPANS_DIR)) {
        fs.mkdirSync(SPANS_DIR);
      }
    })

    beforeEach(async () => {
      waitForDependencySpans = new Promise((resolve) => {
        resolver = resolve;
      });
    });

    afterEach(async () => {
      if (app) {
        // app.kill('SIGINT');
         kill(app.pid);
      }
      await stopWatching();
    });
    for (let componentTest of componentTests){
      it(`${component} -> ${componentTest.getName()} test`, async () => {
        watchDir(SPANS_DIR, {
          onAddFileEvent: (path) => determineIfSpansAreReady(componentTest, path, resolver),
          onChangeFileEvent: (path) => determineIfSpansAreReady(componentTest, path, resolver),
        });
        const FILE_EXPORTER_FILE_NAME = `${SPANS_DIR}/spans-test-nodejs.json`;
        app = await waitForChildProcess(
            `./test/component/${component}/app`,
            componentTest.onChildProcessReady,
            componentTest.isChildProcessReadyPredicate,
            `start:${componentTest.getName()}:injected`,
            {
              LUMIGO_TRACER_TOKEN: 't_123321',
              LUMIGO_DEBUG_SPANDUMP: FILE_EXPORTER_FILE_NAME,
              OTEL_SERVICE_NAME: 'http-js',
              LUMIGO_DEBUG: true,
              ...componentTest.getEnvVars()
            },
            5000
        );
        await waitAndRunSpansAssertions(waitForDependencySpans, componentTest, 10000);
      }, 10000);
    }

  });
}
