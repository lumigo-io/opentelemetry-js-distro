import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor, SimpleSpanProcessor, SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import LumigoExpressInstrumentation from './instrumentors/LumigoExpressInstrumentation';
import LumigoHttpInstrumentation from './instrumentors/LumigoHttpInstrumentation';
import { FileSpanExporter } from './exporters';
import { AwsEcsDetector, LumigoDistroDetector } from './resources/detectors';
import { isEnvVarTrue } from './utils';

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

function requireIfAvailable(names: string[]) {
  names.forEach((name) => safeRequire(name));
}

requireIfAvailable([
  ...MODULES_TO_INSTRUMENT,
  ...JSON.parse(process.env.MODULES_TO_INSTRUMENT || '[]'),
]);

export class LumigoInitializationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

class LumigoSwitchedOffError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/*
 * We do not use the `@opentelemetry/sdk-node` package because it has a large
 * amount of dependencies.
 */
const init = async (
  lumigoEndpoint: string,
  lumigoToken: string,
) => {
  return new Promise((resolve, reject) => {
    if (isEnvVarTrue(LUMIGO_SWITCH_OFF)) {
      reject(new LumigoSwitchedOffError('Lumigo is switched off, tracer will not be initialized'));
    } else {
      resolve(undefined);
    }
  })
  .then(() => {
    return Promise.all(
      [
        new LumigoDistroDetector(__dirname).detect(),
        Promise.resolve(new Resource({
          runtime: `node${process.version}`,
          framework: 'express',
          exporter: 'opentelemetry',
          envs: JSON.stringify(process.env),
        })),
        new AwsEcsDetector().detect()
      ]
    );
  })
  .then((resources: Resource[]) => {
    let resource = Resource.default();
    resources.forEach(otherResource => {
      resource = resource.merge(otherResource);
    });
    return resource;
  }) // Init trace provider
  .then((resource) => new NodeTracerProvider({
    resource: resource,
  })) // Init span processors
  .then((traceProvider) => {
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

    return traceProvider;
  }) // Register instrumentations
  .then((traceProvider) => {
    registerInstrumentations({
      instrumentations: [
        new LumigoHttpInstrumentation(lumigoEndpoint),
        new LumigoExpressInstrumentation(),
        ...externalInstrumentations,
      ],
    });

    return traceProvider;
  }) // Register trace provider and start the collection of spans
  .then((traceProvider) => {
    traceProvider.register();
    diag.debug('Lumigo tracer initialized');
    return true;
  }) //
  .catch((exception) => {
    if (exception instanceof LumigoSwitchedOffError) {
      diag.info('Lumigo is switched off, tracer will not be initialized');
      return false;
    } else {
      diag.error('Error initializing Lumigo tracer: %e', exception);
      throw new LumigoInitializationError(exception);
    }
  });
}

/*
 * If the SDK has been initialized, this Promise returns `true`; otherwise,
 * the SDK has not been initialized because the `LUMIGO_SWITCH_OFF` environment
 * variable is set to true. The Promise is rejected if an initialization error
 * occurs.
 */
export const sdkInit: Promise<boolean> = init(
  process.env.LUMIGO_ENDPOINT || DEFAULT_LUMIGO_ENDPOINT,
  process.env.LUMIGO_TRACER_TOKEN,
);

module.exports = {
  LumigoInitializationError,
  LumigoHttpInstrumentation,
  LumigoExpressInstrumentation,
  externalInstrumentations,
  sdkInit,
};
