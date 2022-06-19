import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import LumigoExpressInstrumentation from './instrumentors/LumigoExpressInstrumentation';
import LumigoHttpInstrumentation from './instrumentors/LumigoHttpInstrumentation';
import { FileSpanExporter } from './exporters';
import { isEnvVarTrue, safeExecute } from './utils';

let isLumigoSwitchedOffStatusReported = false;
let isTraced = false;

export const DEFAULT_LUMIGO_ENDPOINT = 'https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/traces';
const MODULES_TO_INSTRUMENT = ['express', 'http', 'https'];
const LUMIGO_DEBUG = 'LUMIGO_DEBUG';
const LUMIGO_SWITCH_OFF = 'LUMIGO_SWITCH_OFF';

let logLevel: DiagLogLevel;
if (isEnvVarTrue(LUMIGO_SWITCH_OFF)) {
  logLevel = DiagLogLevel.INFO;
} else {
  logLevel = isEnvVarTrue(LUMIGO_DEBUG) ? DiagLogLevel.ALL : DiagLogLevel.ERROR;
}
diag.setLogger(new DiagConsoleLogger(), logLevel);

const externalInstrumentations = [];

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

requireIfAvailable([
  ...MODULES_TO_INSTRUMENT,
  ...JSON.parse(process.env.MODULES_TO_INSTRUMENT || '[]'),
]);

const initializeTracer = (
  lumigoEndpoint: string,
  lumigoToken: string,
) => {
  try {
    const traceProvider = new NodeTracerProvider({
      resource: Resource.default().merge(new Resource({
        runtime: `node${process.version}`,
        tracerVersion: getTracerInfo().version,
        framework: 'express',
        exporter: 'opentelemetry',
        envs: JSON.stringify(process.env),
      })),
    });

    if (lumigoToken) {
      const exporter = new OTLPTraceExporter({
        url: lumigoEndpoint,
        headers: {
          'Authorization': `LumigoToken ${lumigoToken}`
        }
      });

      traceProvider.addSpanProcessor(
        new BatchSpanProcessor(exporter, {
          // The maximum queue size. After the size is reached spans are dropped.
          maxQueueSize: 1000,
          // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
          maxExportBatchSize: 100,
        })
      );
    } else {
      diag.warn(
        "Lumigo token not provided (env var 'LUMIGO_TRACER_TOKEN' not set); no data will be sent to Lumigo"
      )
    }

    const lumigoSpanDumpFile = process.env.LUMIGO_DEBUG_SPANDUMP
    if (lumigoSpanDumpFile) {
      traceProvider.addSpanProcessor(new SimpleSpanProcessor(new FileSpanExporter(lumigoSpanDumpFile)));
    }

    registerInstrumentations({
      instrumentations: [
        new LumigoHttpInstrumentation(lumigoEndpoint),
        new LumigoExpressInstrumentation(),
        ...externalInstrumentations,
      ],
    });
    
    traceProvider.register();
    isTraced = true;

    diag.debug('Lumigo tracer initialized');
  } catch (exception) {
    diag.error('Error initializing Lumigo tracer: ', exception);
  }
};

if (isTraced) {
  diag.debug('Lumigo tracer already initialized');
} else {
  if (isEnvVarTrue(LUMIGO_SWITCH_OFF)) {
    if (!isLumigoSwitchedOffStatusReported) {
      isLumigoSwitchedOffStatusReported = true;
      diag.info('Lumigo is switched off, tracer will not be initialized');
    }
  } else {
    initializeTracer(
      process.env.LUMIGO_ENDPOINT || DEFAULT_LUMIGO_ENDPOINT,
      process.env.LUMIGO_TRACER_TOKEN,
    );
  }
}

module.exports = {
  LumigoHttpInstrumentation,
  LumigoExpressInstrumentation,
  externalInstrumentations,
  initializeTracer,
};
