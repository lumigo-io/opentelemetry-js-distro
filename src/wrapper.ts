import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { detectResources, envDetector, processDetector, Resource } from '@opentelemetry/resources';
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { FileSpanExporter } from './exporters';
import LumigoExpressInstrumentation from './instrumentations/express/ExpressInstrumentation';
import LumigoHttpInstrumentation from './instrumentations/https/HttpInstrumentation';
import { extractEnvVars, isEnvVarTrue, logger, safeRequire } from './utils';
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

export interface LumigoSdkInitialization {
  readonly tracerProvider: BasicTracerProvider;
}

const trace = async (): Promise<LumigoSdkInitialization> => {
  if (!isTraceInitialized) {
    isTraceInitialized = true;
    try {
      if (isEnvVarTrue(LUMIGO_SWITCH_OFF)) {
        logger.info(
          'The Lumigo OpenTelemetry Distro is switched off (the "LUMIGO_SWITCH_OFF" environment variable is set): no telemetry will be sent to Lumigo.'
        );
        return;
      }

      if (!process.env.LUMIGO_TRACER_TOKEN) {
        logger.warn(
          'The Lumigo token is not available (the "LUMIGO_TRACER_TOKEN" environment variable is not set): no telemetry will sent to Lumigo.'
        );
      }

      const lumigoEndpoint = process.env.LUMIGO_ENDPOINT || DEFAULT_LUMIGO_ENDPOINT;
      const lumigoToken = process.env.LUMIGO_TRACER_TOKEN;
      const lumigoSpanDumpPath = process.env.LUMIGO_DEBUG_SPANDUMP;

      const detectedResource = await detectResources({
        detectors: [
          envDetector,
          processDetector,
          awsResourceDetectors.awsEcsDetector,
          new AwsEcsDetector(),
          new LumigoDistroDetector(),
        ],
      });

      const tracerProvider = new NodeTracerProvider({
        resource: Resource.default()
          .merge(
            new Resource({
              framework: 'express',
              'process.environ': JSON.stringify(extractEnvVars()),
            })
          )
          .merge(detectedResource),
      });

      if (lumigoSpanDumpPath) {
        tracerProvider.addSpanProcessor(
          new SimpleSpanProcessor(new FileSpanExporter(lumigoSpanDumpPath))
        );
      }

      if (lumigoToken) {
        const otlpExporter = new OTLPTraceExporter({
          url: lumigoEndpoint,
          headers: {
            Authorization: `LumigoToken ${lumigoToken.trim()}`,
          },
        });

        tracerProvider.addSpanProcessor(
          new BatchSpanProcessor(otlpExporter, {
            // The maximum queue size. After the size is reached spans are dropped.
            maxQueueSize: 1000,
            // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
            maxExportBatchSize: 100,
          })
        );
      }

      tracerProvider.register();

      logger.info(`Lumigo tracer started.`);
      return Promise.resolve({
        tracerProvider: tracerProvider,
      });
    } catch (err) {
      reportInitError(err);
      return Promise.reject(err);
    }
  } else {
    logger.debug(
      'The Lumigo OpenTelemetry Distro is already initialized: additional attempt to initialize has been ignored.'
    );
  }
};

export const init = trace();
