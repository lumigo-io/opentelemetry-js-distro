import fs from 'fs';
const rimraf = require('rimraf');
import { watchDir, stopWatching } from './helpers/fileListener';
import { waitForChildProcess } from './helpers/helpers';
import InstrumentationNode from './instrumentationsTests/http';
import {determineIfSpansAreReady} from "./testUtils/utils";


const SPANS_DIR = `${__dirname}/component/http/spans`;
describe('When express isnt installed', () => {
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
    if (!fs.existsSync(SPANS_DIR)) {
      fs.mkdirSync(SPANS_DIR);
    }
    watchDir(SPANS_DIR, {
      onAddFileEvent: (path) => determineIfSpansAreReady(InstrumentationNode, path, resolver),
      onChangeFileEvent: (path) => determineIfSpansAreReady(InstrumentationNode, path, resolver),
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
      './test/component/http',
      InstrumentationNode.onChildProcessReady,
      InstrumentationNode.isChildProcessReadyPredicate,
      `start:nodejs:injected`,
      {
        LUMIGO_TRACER_TOKEN: 't_123321',
        LUMIGO_DEBUG_SPANDUMP: FILE_EXPORTER_FILE_NAME,
        OTEL_SERVICE_NAME: 'express-js',
        LUMIGO_DEBUG: true,
      },
      10000
    );

    const spans = (await waitForDependencySpans).map((text) => JSON.parse(text));
    InstrumentationNode.runTests(spans);
  }, 20000);
});
