import fs from 'fs';
const rimraf = require('rimraf');
import { watchDir, stopWatching } from './helpers/fileListener';
import { waitForChildProcess } from './helpers/helpers';
import { InstrumentationTest } from './instrumentations/InstrumentationTest';
import InstrumentationNode from './instrumentations/nodejs';
import * as path from "path";

function determineIfSpansAreReady(
  dependencyTest: InstrumentationTest,
  path: string,
  resolve: (value: unknown) => void
) {
  const allFileContents = fs.readFileSync(path, 'utf-8');
  const lines = allFileContents.split(/\r?\n/).filter((l) => l !== '');
  InstrumentationNode.spansReadyCondition(lines, resolve);
}

const SPANS_DIR = `${__dirname}/node/nodejs/spans`;
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
    if (app) app.kill('SIGINT');
  });

  afterEach(async () => {
    if (app) app.kill('SIGINT');
    rimraf.sync(SPANS_DIR);
    await stopWatching();
  });

  it('should set framework to nodejs', async () => {
    const FILE_EXPORTER_FILE_NAME = `${__dirname}/node/nodejs/spans/spans-test-nodejs.json`;
    app = await waitForChildProcess(
      './test/component/node/nodejs',
      InstrumentationNode.onChildProcessReady,
      InstrumentationNode.isChildProcessReadyPredicate,
      `start:nodejs:injected`,
      {
        NODE_PATH: path.resolve(`${__dirname}/node/nodejs`),
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
