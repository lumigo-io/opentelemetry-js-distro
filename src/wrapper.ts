import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import LumigoExpressInstrumentation from './instrumentors/LumigoExpressInstrumentation';
import LumigoHttpInstrumentation from './instrumentors/LumigoHttpInstrumentation';
import { FileSpanExporter } from './exporters';
import { fetchMetadataUri, isEnvVarTrue, safeExecute } from './utils';

let isLumigoSwitchedOffStatusReported = false;

export const DEFAULT_LUMIGO_ENDPOINT = 'https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/traces';
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

let initializationPromise = undefined;
const externalInstrumentations = [];
export const clearIsTraced = () => (initializationPromise = undefined);

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

export const getTracerInfo = (): { name: string, version: string } => {
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
    new LumigoHttpInstrumentation(process.env.LUMIGO_TOKEN, process.env.LUMIGO_ENDPOINT),
    new LumigoExpressInstrumentation(),
    ...externalInstrumentations,
  ],
});
requireIfAvailable([
  ...MODULES_TO_INSTRUMENT,
  ...JSON.parse(process.env.MODULES_TO_INSTRUMENT || '[]'),
]);

function reportInitError(err) {
  diag.error('Error initializing Lumigo tracer: ', err);
}

export const trace = async (
  lumigoToken = '',
  serviceName = 'service-name',
  endpoint = DEFAULT_LUMIGO_ENDPOINT
): Promise<boolean> => {
  if (!initializationPromise) {
    initializationPromise = new Promise((resolve) => {
      try {
        if (isEnvVarTrue(LUMIGO_SWITCH_OFF)) {
          if (!isLumigoSwitchedOffStatusReported) {
            isLumigoSwitchedOffStatusReported = true;
            diag.info('Lumigo is switched off, aborting tracer initialization...');
          }
          return resolve(undefined);
        }
        const exporter = isEnvVarTrue(LUMIGO_DEBUG_SPANDUMP)
          ? new FileSpanExporter(
              process.env.FILE_EXPORTER_FILE_NAME,
              isEnvVarTrue(LUMIGO_DEBUG) ? 'DEBUG' : 'PROD'
            )
          : new OTLPTraceExporter({
              url: endpoint,
              headers: {
                Authorization: `LumigoToken ${lumigoToken.trim()}`,
              },
            });
        const ecsMetadataHandler = (data) => {
          const config = {
            resource: new Resource({
              lumigoToken: lumigoToken.trim(),
              'service.name': serviceName,
              runtime: `node${process.version}`,
              tracerVersion: getTracerInfo().version,
              framework: 'express',
              exporter: 'opentelemetry',
              envs: JSON.stringify(process.env),
              metadata: data,
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
          diag.debug(`Lumigo tracer started on ${serviceName}`);
          return resolve(undefined);
        };

        fetchMetadataUri()
          .then((res) => {
            ecsMetadataHandler(res?.data);
          })
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          .catch((_) => {
            ecsMetadataHandler(undefined);
          })
          .catch((err) => {
            reportInitError(err);
          });
      } catch (err) {
        reportInitError(err);
        return resolve(undefined);
      }
    });
  } else {
    diag.debug('Lumigo already traced, aborting tracer initialization...');
  }
  return initializationPromise;
};

if (process.env.LUMIGO_TOKEN && process.env.LUMIGO_SERVICE_NAME) {
  initializationPromise = trace(
    process.env.LUMIGO_TOKEN,
    process.env.LUMIGO_SERVICE_NAME,
    process.env.LUMIGO_ENDPOINT || DEFAULT_LUMIGO_ENDPOINT
  );
}
export default initializationPromise;
module.exports = {
  DEFAULT_LUMIGO_ENDPOINT,
  clearIsTraced,
  trace,
  initializationPromise,
};
