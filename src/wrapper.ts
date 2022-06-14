import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { InstrumentationBase, registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import LumigoExpressInstrumentation from './instrumentros/LumigoExpressInstrumentation';
import LumigoHttpInstrumentation from './instrumentros/LumigoHttpInstrumentation';
import { isEnvVarTrue, safeExecute } from './utils';

let isLumigoSwitchedOffStatusReported = false;
let isTraced = false;

export const LUMIGO_ENDPOINT = 'https://ga-otlp.lumigo-tracer-edge.golumigo.com/api/spans';
const MODULES_TO_INSTRUMENT = ['express', 'http', 'https'];
const LUMIGO_DEBUG = 'LUMIGO_DEBUG';
const LUMIGO_SWITCH_OFF = 'LUMIGO_SWITCH_OFF';
const LUMIGO_DEBUG_SPANDUMP = 'LUMIGO_DEBUG_SPANDUMP';

let logLevel: DiagLogLevel;
if (isEnvVarTrue(LUMIGO_SWITCH_OFF)) {
  logLevel = DiagLogLevel.INFO;
} else {
  logLevel = isEnvVarTrue(LUMIGO_DEBUG) ? DiagLogLevel.ALL : DiagLogLevel.ERROR;
}
diag.setLogger(new DiagConsoleLogger(), logLevel);

const externalInstrumentations = [];

export const clearIsTraced = () => (isTraced = false);

export const addInstrumentation = (instrumentation: InstrumentationBase) => {
  if (isTraced) {
    console.warn(
      `Lumigo already traced, Try first adding your instrumentation and then calling trace()`
    );
  } else if (instrumentation instanceof InstrumentationBase) {
    externalInstrumentations.push(instrumentation);
  } else {
    console.warn(`"instrumentation" is not an instance of InstrumentationBase`);
  }
};

const safeRequire = (libId) => {
  try {
    const customReq =
      // eslint-disable-next-line no-undef,camelcase
      // @ts-ignore __non_webpack_require__ not available at compile time
      typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
    return customReq(libId);
  } catch (e) {
    try {
      const customReq =
        // eslint-disable-next-line no-undef,camelcase
        // @ts-ignore __non_webpack_require__ not available at compile time
        typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
      const path = customReq.resolve(libId, {
        paths: [...process.env.NODE_PATH.split(':'), '/var/task/node_modules/'],
      });
      return customReq(path);
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') {
        diag.warn('Unable to load module', {
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
    'Failed to determine wrapper version',
    'warn',
    { name: '@lumigo/opentelemetry', version: '0.0.0' }
  )();
};

function requireIfAvailable(names: string[]) {
  names.forEach((name) => safeRequire(name));
}

registerInstrumentations({
  instrumentations: [
    new LumigoHttpInstrumentation(process.env.LUMIGO_TOKEN, LUMIGO_ENDPOINT),
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
    if (isEnvVarTrue(LUMIGO_SWITCH_OFF)) {
      if (!isLumigoSwitchedOffStatusReported) {
        isLumigoSwitchedOffStatusReported = true;
        diag.info('Lumigo is switched off, aborting tracer initialization...');
      }
      return;
    }
    if (isTraced) {
      diag.debug('Lumigo already traced, aborting tracer initialization...');
      return;
    }
    const exporter = isEnvVarTrue(LUMIGO_DEBUG_SPANDUMP)
      ? new ConsoleSpanExporter()
      : new OTLPTraceExporter({
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
    if (isTraced) {
      diag.debug('Lumigo already traced, aborting tracer initialization...');
      return;
    }
    traceProvider.register();
    isTraced = true;
    diag.debug(`Lumigo tracer started on ${serviceName}`);
  } catch (exception) {
    console.error('Error initializing Lumigo tracer: ', exception);
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
