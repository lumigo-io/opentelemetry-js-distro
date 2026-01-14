import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import type { Resource } from '@opentelemetry/resources';
import { detectResources, envDetector, processDetector, emptyResource, resourceFromAttributes, defaultResource } from '@opentelemetry/resources';
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import type { LoggerProvider as ApiLoggerProvider } from '@opentelemetry/api-logs';
import * as logsAPI from '@opentelemetry/api-logs';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import * as awsResourceDetectors from '@opentelemetry/resource-detector-aws';
import {
  DEFAULT_DEPENDENCIES_ENDPOINT,
  DEFAULT_LUMIGO_TRACES_ENDPOINT,
  DEFAULT_LUMIGO_LOGS_ENDPOINT,
  TRACING_ENABLED,
  LOGGING_ENABLED,
} from './constants';
import { report } from './dependencies';
import { FileLogExporter, FileSpanExporter } from './exporters';

import LumigoGrpcInstrumentation from './instrumentations/@grpc/grpc-js/GrpcInstrumentation';
import LumigoNestInstrumentation from './instrumentations/@nestjs/core/NestInstrumentation';
import LumigoAmqplibInstrumentation from './instrumentations/amqplib/AmqplibInstrumentation';
import LumigoExpressInstrumentation from './instrumentations/express/ExpressInstrumentation';
import LumigoFastifyInstrumentation from './instrumentations/fastify/FastifyInstrumentation';
import LumigoHttpInstrumentation from './instrumentations/https/HttpInstrumentation';
import LumigoIORedisInstrumentation from './instrumentations/ioredis/IORedisInstrumentation';
import LumigoKafkaJsInstrumentation from './instrumentations/kafkajs/KafkaJsInstrumentation';
import LumigoMongoDBInstrumentation from './instrumentations/mongodb/MongoDBInstrumentation';
import LumigoPgInstrumentation from './instrumentations/pg/PgInstrumentation';
import LumigoPrismaInstrumentation from './instrumentations/prisma/PrismaInstrumentation';
import LumigoRedisInstrumentation from './instrumentations/redis/RedisInstrumentation';
import {
  LumigoAwsSdkV2LibInstrumentation,
  LumigoAwsSdkV3LibInstrumentation,
} from './instrumentations/aws-sdk';
import LumigoWinstonInstrumentation from './instrumentations/winston/WinstonInstrumentation';
import LumigoBunyanInstrumentation from './instrumentations/bunyan/BunyanInstrumentation';
import LumigoPinoInstrumentation from './instrumentations/pino/PinoInstrumentation';

import { LumigoW3CTraceContextPropagator } from './propagator/w3cTraceContextPropagator';
import {
  LumigoContainerNameDetector,
  LumigoDistroDetector,
  LumigoKubernetesDetector,
  LumigoTagDetector,
} from './resources/detectors';
import { getLogAttributeMaxLength, getSpanAttributeMaxLength } from './utils';
import { safeRequire } from './requireUtils';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      LUMIGO_DEBUG?: string;
      LUMIGO_DEBUG_SPANDUMP?: string;
      LUMIGO_DEBUG_LOGDUMP?: string;
      LUMIGO_ENDPOINT?: string;
      LUMIGO_ENABLE_LOGS?: string;
      LUMIGO_LOGS_ENDPOINT?: string;
      LUMIGO_REPORT_DEPENDENCIES?: string;
      LUMIGO_SWITCH_OFF?: string;
      LUMIGO_TRACER_TOKEN?: string;
    }
  }
}

export interface LumigoSdkInitialization {
  readonly tracerProvider: BasicTracerProvider;
  readonly loggerProvider: ApiLoggerProvider;
  readonly resource: Resource;
  readonly instrumentedModules: string[];
  readonly reportDependencies: Promise<void | Object>;
}

import { dirname, join } from 'path';
import { logger } from './logging';
import { ProcessEnvironmentDetector } from './resources/detectors/ProcessEnvironmentDetector';
import { LumigoSpanProcessor } from './resources/spanProcessor';
import { getCombinedSampler } from './samplers/combinedSampler';
import { LumigoLogRecordProcessor } from './processors/LumigoLogRecordProcessor';

const lumigoTraceEndpoint = process.env.LUMIGO_ENDPOINT || DEFAULT_LUMIGO_TRACES_ENDPOINT;
const lumigoLogEndpoint = process.env.LUMIGO_LOGS_ENDPOINT || DEFAULT_LUMIGO_LOGS_ENDPOINT;

let isTraceInitialized = false;

function reportInitError(err: Error) {
  logger.error(
    'An error occurred while initializing the Lumigo OpenTelemetry Distro: no telemetry will be collected and sent to Lumigo.',
    err
  );
}

export const init = async (): Promise<LumigoSdkInitialization> => {
  if (isTraceInitialized) {
    const message =
      'The Lumigo OpenTelemetry Distro is already initialized: additional attempt to initialize has been ignored.';
    logger.debug(message);

    throw new Error(message);
  }

  isTraceInitialized = true;

  try {
    if (process.env.LUMIGO_SWITCH_OFF?.toLowerCase() === 'true') {
      logger.info(
        'The Lumigo OpenTelemetry Distro is switched off (the "LUMIGO_SWITCH_OFF" environment variable is set): no telemetry will be sent to Lumigo.'
      );
      return;
    }

    const { version: distroVersion } =
      safeRequire(join(dirname(__dirname), 'package.json')) ||
      safeRequire(join(__dirname, 'package.json')) ||
      {};

    const ignoredHostnames = [new URL(lumigoTraceEndpoint).hostname];
    if (lumigoTraceEndpoint != DEFAULT_LUMIGO_TRACES_ENDPOINT) {
      ignoredHostnames.push(new URL(DEFAULT_DEPENDENCIES_ENDPOINT).hostname);
    }

    const instrumentationsToInstall = [
      new LumigoAmqplibInstrumentation(),
      new LumigoExpressInstrumentation(),
      new LumigoGrpcInstrumentation(),
      new LumigoNestInstrumentation(),
      new LumigoFastifyInstrumentation(),
      new LumigoHttpInstrumentation(...ignoredHostnames),
      new LumigoIORedisInstrumentation(),
      new LumigoKafkaJsInstrumentation(),
      new LumigoMongoDBInstrumentation(),
      new LumigoPgInstrumentation(),
      new LumigoPrismaInstrumentation(),
      new LumigoRedisInstrumentation(),
      new LumigoAwsSdkV2LibInstrumentation(),
      new LumigoAwsSdkV3LibInstrumentation(),

      // Loggers
      new LumigoWinstonInstrumentation(),
      new LumigoBunyanInstrumentation(),
      new LumigoPinoInstrumentation(),
    ].filter((i) => i.isApplicable());

    /*
     * Register instrumentation globally, so that all tracer providers
     * will receive traces. This may be necessary when there is already
     * built-in instrumentation in the app.
     */
    registerInstrumentations({
      instrumentations: instrumentationsToInstall.map((i) => i.getInstrumentation()),
    });

    const instrumentedModules: string[] = instrumentationsToInstall.map((i) =>
      i.getInstrumentedModule()
    );

    logger.debug(`Instrumented modules: ${instrumentedModules.join(', ')}`);

    const lumigoToken = process.env.LUMIGO_TRACER_TOKEN;

    if (!lumigoToken) {
      logger.warn(
        'The Lumigo token is not available (the "LUMIGO_TRACER_TOKEN" environment variable is not set): no telemetry will be sent to Lumigo.'
      );
    }

    const lumigoReportDependencies =
      process.env.LUMIGO_REPORT_DEPENDENCIES?.toLowerCase() !== 'false';

    const infrastructureDetectors = [
      envDetector,
      processDetector,
      new LumigoDistroDetector(distroVersion),
      new LumigoKubernetesDetector(),
      new LumigoTagDetector(),
      new LumigoContainerNameDetector(),
    ];

    if (process.env.ECS_CONTAINER_METADATA_URI || process.env.ECS_CONTAINER_METADATA_URI_V4) {
      /*
       * The ECS detector does not have a component logger we can suppress, to we need to
       * check whether we should try it at all.
       */
      infrastructureDetectors.push(awsResourceDetectors.awsEcsDetector);
    }

    /*
     * These are the resources describing the infrastructure and the runtime that will be
     * sent along with the dependency reporting.
     */
    const infrastructureResource = defaultResource().merge(
      detectResources({
        detectors: infrastructureDetectors,
      })
    );

    const framework = instrumentedModules.includes('express') ? 'express' : 'node';

    const processEnvDetectedResource = new ProcessEnvironmentDetector().detect();
    const resource = defaultResource()
      .merge(resourceFromAttributes({
        framework,
      }))
      .merge(infrastructureResource)
      .merge(resourceFromAttributes(processEnvDetectedResource.attributes || {}));

    // Build span processors array
    const spanProcessors = [];
    if (process.env.LUMIGO_DEBUG_SPANDUMP) {
      spanProcessors.push(
        new SimpleSpanProcessor(new FileSpanExporter(process.env.LUMIGO_DEBUG_SPANDUMP))
      );
    }

    // Build log record processors array
    const logRecordProcessors = [new LumigoLogRecordProcessor()];
    if (process.env.LUMIGO_DEBUG_LOGDUMP) {
      logRecordProcessors.push(
        new SimpleLogRecordProcessor(new FileLogExporter(process.env.LUMIGO_DEBUG_LOGDUMP))
      );
    }

    let reportDependencies: Promise<void | Object>;

    if (lumigoToken) {
      const otlpTraceExporter = new OTLPTraceExporter({
        url: lumigoTraceEndpoint,
        headers: {
          Authorization: `LumigoToken ${lumigoToken.trim()}`,
        },
      });

      if (TRACING_ENABLED) {
        spanProcessors.push(
          new LumigoSpanProcessor(otlpTraceExporter, {
            // The maximum queue size. After the size is reached spans are dropped.
            maxQueueSize: 1000,
            // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
            maxExportBatchSize: 100,
          })
        );
      } else {
        logger.info(
          'Tracing is disabled (the "LUMIGO_ENABLE_TRACES" environment variable is not set to "true"): no traces will be sent to Lumigo.'
        );
      }

      const otlpLogExporter = new OTLPLogExporter({
        url: lumigoLogEndpoint,
        headers: {
          Authorization: `LumigoToken ${lumigoToken.trim()}`,
        },
      });

      if (LOGGING_ENABLED) {
        logRecordProcessors.push(
          new BatchLogRecordProcessor(otlpLogExporter, {
            // The maximum queue size. After the size is reached logs are dropped.
            maxQueueSize: 1000,
            // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
            maxExportBatchSize: 100,
          })
        );
      } else {
        logger.info(
          'Logging is disabled (the "LUMIGO_ENABLE_LOGS" environment variable is not set to "true"): no logs will be sent to Lumigo.'
        );
      }

      /*
       * We do not wait for this promise, we do not want to delay the application.
       * Dependency reporting is done "best effort".
       */
      if (!lumigoReportDependencies) {
        reportDependencies = Promise.resolve('Dependency reporting is turned off');
      } else {
        /*
         * We pass `detectedResource` as opposed to `tracerProvider.resource`
         * because we want only the infrastructure-related resource attributes
         * like ARNs, and specifically we do not need the process environment.
         */
        reportDependencies = report(
          DEFAULT_DEPENDENCIES_ENDPOINT,
          lumigoToken,
          infrastructureResource.attributes
        );
      }
    } else {
      reportDependencies = Promise.resolve('No Lumigo token available');
    }

    // Create providers with processors
    const tracerProvider = new NodeTracerProvider({
      sampler: getCombinedSampler(),
      resource,
      spanLimits: {
        attributeValueLengthLimit: getSpanAttributeMaxLength(),
      },
      spanProcessors,
    });

    const loggerProvider = new LoggerProvider({
      resource,
      logRecordLimits: {
        attributeValueLengthLimit: getLogAttributeMaxLength(),
      },
      processors: logRecordProcessors,
    });

    tracerProvider.register({
      propagator: new LumigoW3CTraceContextPropagator(),
    });

    logsAPI.logs.setGlobalLoggerProvider(loggerProvider);

    logger.info(
      `Lumigo OpenTelemetry Distro ${
        distroVersion ? `v${distroVersion}` : 'with an unknown version'
      } started.`
    );

    return {
      tracerProvider,
      loggerProvider,
      resource,
      reportDependencies,
      instrumentedModules,
    };
  } catch (err) {
    reportInitError(err);
    throw err;
  }
};
