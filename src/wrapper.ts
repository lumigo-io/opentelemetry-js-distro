import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { detectResources, envDetector, processDetector, Resource } from '@opentelemetry/resources';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { FileSpanExporter } from './exporters';
import LumigoExpressInstrumentation from './instrumentors/LumigoExpressInstrumentation';
import LumigoHttpInstrumentation from './instrumentors/LumigoHttpInstrumentation';
import { fetchMetadataUri, isEnvVarTrue, logger } from './utils';
import * as awsResourceDetectors from '@opentelemetry/resource-detector-aws';
import { AwsEcsDetector, LumigoDistroDetector } from './resources/detectors';

const DEFAULT_LUMIGO_ENDPOINT = 'https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/traces';
const MODULES_TO_INSTRUMENT = ['express', 'http', 'https'];
const LUMIGO_DEBUG = 'LUMIGO_DEBUG';
const LUMIGO_SWITCH_OFF = 'LUMIGO_SWITCH_OFF';

if (isEnvVarTrue(LUMIGO_DEBUG)) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
} else {
  diag.setLogger(new DiagConsoleLogger());
}

let isTraceInitialized = false;

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

const ignoreConfig = [
  (url: string) =>
    [
      process.env.LUMIGO_ENDPOINT,
      process.env.ECS_CONTAINER_METADATA_URI,
      process.env.ECS_CONTAINER_METADATA_URI_V4,
    ]
      .filter(Boolean)
      .some((v) => url.includes(v)),
  /169\.254\.\d+\.\d+.*/gm,
];

registerInstrumentations({
  instrumentations: [
    new LumigoHttpInstrumentation(ignoreConfig),
    new LumigoExpressInstrumentation(),
    ...externalInstrumentations,
  ],
});

requireIfAvailable([
  ...MODULES_TO_INSTRUMENT,
  ...JSON.parse(process.env.MODULES_TO_INSTRUMENT || '[]'),
]);

function reportInitError(err) {
  logger.error(
    'An error occurred while initializing the Lumigo OpenTelemetry Distro: no telemetry will be collected and sent to Lumigo.',
    err
  );
}

const trace = async (): Promise<void> => {
  if (!isTraceInitialized) {
    isTraceInitialized = true;
    try {
      if (isEnvVarTrue(LUMIGO_SWITCH_OFF)) {
        logger.info(
          'The Lumigo OpenTelemetry Distro is switched off ("LUMIGO_SWITCH_OFF" is set): no telemetry will be collected and sent to Lumigo.'
        );
        return;
      }
      // if the required environment variables aren't available and the tracing is not being redirected to file
      if (
        !process.env.LUMIGO_DEBUG_SPANDUMP &&
        !(process.env.LUMIGO_TRACER_TOKEN && process.env.OTEL_SERVICE_NAME)
      ) {
        logger.warn(
          'The Lumigo OpenTelemetry Distro tracer token and service name are not available ("LUMIGO_TRACER_TOKEN" and / or "OTEL_SERVICE_NAME" are not set): no telemetry will be collected and sent to Lumigo.'
        );
        return;
      }

      const lumigoToken = process.env.LUMIGO_TRACER_TOKEN;
      const endpoint = process.env.LUMIGO_ENDPOINT || DEFAULT_LUMIGO_ENDPOINT;

      const exporter = process.env.LUMIGO_DEBUG_SPANDUMP
        ? new FileSpanExporter(
            process.env.LUMIGO_DEBUG_SPANDUMP,
            isEnvVarTrue(LUMIGO_DEBUG) ? 'DEBUG' : 'PROD'
          )
        : new OTLPTraceExporter({
            url: endpoint,
            headers: {
              Authorization: `LumigoToken ${lumigoToken.trim()}`,
            },
          });
      const resource = await detectResources({
        detectors: [
          envDetector,
          processDetector,
          awsResourceDetectors.awsEcsDetector,
          new AwsEcsDetector(),
          new LumigoDistroDetector(__dirname),
        ],
      });
      const metadata = await fetchMetadataUri();
      const resourceAttributes = {
        framework: 'express',
        'process.environ': JSON.stringify(process.env),
      };
      if (metadata) Object.assign(resourceAttributes, { metadata });
      const config = {
        resource: new Resource(resourceAttributes).merge(resource),
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
      logger.info(`Lumigo tracer started.`);
      return;
    } catch (err) {
      reportInitError(err);
      return;
    }
  } else {
    logger.debug(
      'The Lumigo OpenTelemetry Distro is already initialized: additional attempt to initialize has been ignored.'
    );
  }
};
export const init = trace();
