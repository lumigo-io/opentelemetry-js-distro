import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import LumigoHttpInstrumentation from './instrumentros/LumigoHttpInstrumentation';
import LumigoExpressInstrumentation from './instrumentros/LumigoExpressInstrumentation';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { InstrumentationBase, registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

import { safeExecute } from './utils';

const logLevel =
  (process.env.LUMIGO_DEBUG || 'false').toLowerCase() === 'true'
    ? DiagLogLevel.ALL
    : DiagLogLevel.ERROR;
diag.setLogger(new DiagConsoleLogger(), logLevel);
export const LUMIGO_ENDPOINT =
  'https://ga-otlp.lumigo-tracer-edge.golumigo.com/api/spans' || process.env.LUMIGO_ENDPOINT;

let isTraced = false;

const MODULES_TO_INSTRUMENT = ['express', 'http', 'https'];

const externalInstrumentations = [];

export const clearIsTraced = () => isTraced = false

export const addInstrumentation = (instrumentation: InstrumentationBase) => {
  if (isTraced) {
    console.warn(
      `Lumigo already traced, Try to first add your instrumentation and then calling trace()`
    );
  } else if (instrumentation instanceof InstrumentationBase) {
    externalInstrumentations.push(instrumentation);
  } else {
    console.warn(`instrumentation is not instance of InstrumentationBase`);
  }
};

const safeRequire = (libId) => {
  try {
    const customReq =
      // eslint-disable-next-line no-undef,camelcase
      // @ts-ignore
      typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
    return customReq(libId);
  } catch (e) {
    try {
      const customReq =
        // eslint-disable-next-line no-undef,camelcase
        // @ts-ignore
        typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
      const path = customReq.resolve(libId, {
        paths: [...process.env.NODE_PATH.split(':'), '/var/task/node_modules/'],
      });
      return customReq(path);
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') {
        diag.warn('Cant load Module', {
          error: e,
          libId: libId,
        });
      }
    }
  }
  return undefined;
};

export const getTracerInfo = (): { name: string; version: string } => {
  return safeExecute(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('../package.json');
      const { name, version } = pkg;
      return { name, version };
    },
    'Failed to get wrapper version',
    'warn',
    { name: '@lumigo/opentelemetry', version: '0.0.0' }
  )();
};

function requireIfAvailable(names: string[]) {
  names.forEach((name) => safeRequire(name));
}

registerInstrumentations({
  instrumentations: [
    // @ts-ignore
    new LumigoHttpInstrumentation(process.env.LUMIGO_TOKEN, LUMIGO_ENDPOINT),
    // @ts-ignore
    new LumigoExpressInstrumentation(),
    ...externalInstrumentations,
  ],
});
requireIfAvailable([
  ...MODULES_TO_INSTRUMENT,
  ...JSON.parse(process.env.MODULES_TO_INSTRUMENT || '[]'),
]);

export const trace = (
  lumigoToken = '',
  serviceName = 'service-name',
  endpoint = LUMIGO_ENDPOINT
) => {
  try {
    if (process.env.LUMIGO_SWITCH_OFF && process.env.LUMIGO_SWITCH_OFF.toLowerCase() === 'true') {
      diag.debug('Lumigo is switched off');
      return;
    }
    if (isTraced) {
      diag.debug('Lumigo already traced');
      return;
    }
    const exporter = new OTLPTraceExporter({
      // @ts-ignore
      serviceName,
      url: endpoint,
    });
    const config = {
      resource: new Resource({
        lumigoToken: lumigoToken.trim(),
        'service.name': serviceName,
        runtime: `node${process.version}`,
        tracerVersion: getTracerInfo().version,
        framework: 'express',
        exporter: 'opentelemetry',
        envs: JSON.stringify(process.env),
      }),
    };
    const traceProvider = new NodeTracerProvider(config);
    traceProvider.addSpanProcessor(
      new BatchSpanProcessor(exporter, {
        // The maximum queue size. After the size is reached spans are dropped.
        maxQueueSize: 1000,
        // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
        maxExportBatchSize: 100,
      })
    );
    traceProvider.register();
    isTraced = true;
    diag.debug(`Lumigo instrumentation started on ${serviceName}`);
  } catch (e) {
    console.error('Lumigo tracer had an Error: ', e);
  }
};

if (process.env.LUMIGO_TOKEN && process.env.LUMIGO_SERVICE_NAME && !isTraced) {
  trace(
    process.env.LUMIGO_TOKEN,
    process.env.LUMIGO_SERVICE_NAME,
    process.env.LUMIGO_ENDPOINT || LUMIGO_ENDPOINT
  );
}

module.exports = {
  clearIsTraced,
  trace,
  LumigoHttpInstrumentation,
  LumigoExpressInstrumentation,
  LumigoInstrumentations: (lumigoToken?: string) => [
    new LumigoHttpInstrumentation(lumigoToken),
    new LumigoExpressInstrumentation(),
  ],
};
