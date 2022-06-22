import { diag, DiagLogger, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { envDetector, processDetector, Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import LumigoExpressInstrumentation from './instrumentors/LumigoExpressInstrumentation';
import LumigoHttpInstrumentation from './instrumentors/LumigoHttpInstrumentation';
import { FileSpanExporter } from './exporters';
import { AwsEcsDetector, LumigoDistroDetector } from './resources/detectors';
import { isEnvVarTrue } from './utils';

const DEFAULT_LUMIGO_ENDPOINT = 'https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/traces';
const MODULES_TO_INSTRUMENT = ['express', 'http', 'https'];
const LUMIGO_DEBUG = 'LUMIGO_DEBUG';
const LUMIGO_SWITCH_OFF = 'LUMIGO_SWITCH_OFF';

let logLevel: DiagLogLevel;
if (isEnvVarTrue(LUMIGO_SWITCH_OFF)) {
  logLevel = DiagLogLevel.INFO;
} else {
  logLevel = isEnvVarTrue(LUMIGO_DEBUG) ? DiagLogLevel.ALL : DiagLogLevel.INFO;
}
diag.setLogger(new DiagConsoleLogger(), logLevel);

const logger: DiagLogger = diag.createComponentLogger({
  namespace: '@lumigo/opentelemetry:',
});

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
        logger.warn('Unable to load module', {
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

class LumigoSwitchedOffError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/*
 * We do not use the `@opentelemetry/sdk-node` package because it has a large
 * amount of dependencies.
 */
const init = async (lumigoEndpoint: string, lumigoToken: string) => {
  return new Promise((resolve, reject) => {
    if (isEnvVarTrue(LUMIGO_SWITCH_OFF)) {
      reject(new LumigoSwitchedOffError('Lumigo is switched off, tracer will not be initialized'));
    } else {
      resolve(undefined);
    }
  })
    .then(() => {
      const envPromise: Promise<Resource> = envDetector.detect().catch((exception) => {
        logger.error(
          'An error occurred while running detecting the environment-based resource attributes',
          exception
        );
        return Resource.EMPTY;
      });
      const processPromise: Promise<Resource> = processDetector.detect().catch((exception) => {
        logger.error(
          'An error occurred while running detecting the Process resource attributes',
          exception
        );
        return Resource.EMPTY;
      });
      const lumigoDistroPromise: Promise<Resource> = new LumigoDistroDetector(__dirname)
        .detect()
        .catch((exception) => {
          logger.error(
            'An error occurred while running detecting the version of the Lumigo OpenTelemetry Distro',
            exception
          );
          return Resource.EMPTY;
        });
      const awsEcsPromise: Promise<Resource> = new AwsEcsDetector().detect().catch((exception) => {
        logger.error(
          'An error occurred while running detecting AWS ECS resource attributes',
          exception
        );
        return Resource.EMPTY;
      });

      return Promise.all([
        lumigoDistroPromise,
        envPromise,
        processPromise,
        awsEcsPromise,
        Promise.resolve(
          new Resource({
            framework: 'express',
            envs: JSON.stringify(process.env),
          })
        ),
      ]);
    })
    .then((resources: Resource[]) => {
      let resource = Resource.default();

      resources.forEach((otherResource) => {
        resource = resource.merge(otherResource);
      });

      return resource;
    }) // Init trace provider
    .then((resource) => {
      return new NodeTracerProvider({
        resource: resource,
      });
    }) // Init span processors
    .then((traceProvider) => {
      if (lumigoToken) {
        const exporter = new OTLPTraceExporter({
          url: lumigoEndpoint,
          headers: {
            Authorization: `LumigoToken ${lumigoToken}`,
          },
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
        logger.warn(
          "Lumigo token not provided (env var 'LUMIGO_TRACER_TOKEN' not set); no data will be sent to Lumigo"
        );
      }

      const lumigoSpanDumpFile = process.env.LUMIGO_DEBUG_SPANDUMP;
      if (lumigoSpanDumpFile) {
        traceProvider.addSpanProcessor(
          new SimpleSpanProcessor(new FileSpanExporter(lumigoSpanDumpFile))
        );
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
      logger.debug('Lumigo OpenTelemetry Distro initialized');
      return {
        traceProvider: traceProvider,
      };
    }) //
    .catch((exception) => {
      if (exception instanceof LumigoSwitchedOffError) {
        logger.info('Lumigo OpenTelemetry Distro is switched off, no telemetry will be collected');
        return undefined;
      } else {
        logger.error(
          'Error initializing the Lumigo OpenTelemetry Distro, no telemetry will be collected: ',
          exception
        );
        return Promise.reject(exception);
      }
    });
};

export class LumigoSdkStatus {
  readonly traceProvider: NodeTracerProvider;
}

/*
 * If the SDK has been initialized, this Promise returns `true`; otherwise,
 * the SDK has not been initialized because the `LUMIGO_SWITCH_OFF` environment
 * variable is set to true. The Promise is rejected if an initialization error
 * occurs.
 */
const sdkInit: Promise<LumigoSdkStatus | Error> = init(
  process.env.LUMIGO_ENDPOINT || DEFAULT_LUMIGO_ENDPOINT,
  process.env.LUMIGO_TRACER_TOKEN
);

module.exports = {
  DEFAULT_LUMIGO_ENDPOINT,
  LumigoHttpInstrumentation,
  LumigoExpressInstrumentation,
  externalInstrumentations,
  sdkInit,
};
