import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Instrumentation, registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource, detectResources, envDetector, processDetector } from '@opentelemetry/resources';
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import * as awsResourceDetectors from '@opentelemetry/resource-detector-aws';
import { DEFAULT_DEPENDENCIES_ENDPOINT, DEFAULT_LUMIGO_ENDPOINT } from './constants';
import { report } from './dependencies';
import { FileSpanExporter } from './exporters';
import LumigoGrpcInstrumentation from './instrumentations/@grpc/grpc-js/GrpcInstrumentation';
import LumigoAmqplibInstrumentation from './instrumentations/amqplib/AmqplibInstrumentation';
import LumigoExpressInstrumentation from './instrumentations/express/ExpressInstrumentation';
import LumigoFastifyInstrumentation from './instrumentations/fastify/FastifyInstrumentation';
import LumigoHttpInstrumentation from './instrumentations/https/HttpInstrumentation';
import LumigoIORedisInstrumentation from './instrumentations/ioredis/IORedisInstrumentation';
import LumigoKafkaJsInstrumentation from './instrumentations/kafkajs/KafkaJsInstrumentation';
import LumigoMongoDBInstrumentation from './instrumentations/mongodb/MongoDBInstrumentation';
import LumigoPrismaInstrumentation from './instrumentations/prisma/PrismaInstrumentation';
import LumigoRedisInstrumentation from './instrumentations/redis/RedisInstrumentation';
import { LumigoAwsSdkLibInstrumentation } from './instrumentations/aws-sdk/LumigoAwsSdklibInstrumentation';
import { LumigoW3CTraceContextPropagator } from './propagator/w3cTraceContextPropagator';
import {
  LumigoContainerNameDetector,
  LumigoDistroDetector,
  LumigoKubernetesDetector,
  LumigoTagDetector,
} from './resources/detectors';
import { getSpanAttributeMaxLength } from './utils';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      LUMIGO_DEBUG?: string;
      LUMIGO_DEBUG_SPANDUMP?: string;
      LUMIGO_ENDPOINT?: string;
      LUMIGO_REPORT_DEPENDENCIES?: string;
      LUMIGO_SWITCH_OFF?: string;
      LUMIGO_TRACER_TOKEN?: string;
    }
  }
}

export interface LumigoSdkInitialization {
  readonly tracerProvider: BasicTracerProvider;
  readonly instrumentedModules: string[];
  readonly reportDependencies: Promise<void | Object>;
}

import { dirname, join } from 'path';
import { logger } from './logging';
import { ProcessEnvironmentDetector } from './resources/detectors/ProcessEnvironmentDetector';
import { LumigoSpanProcessor } from './resources/spanProcessor';
import { getLumigoSampler } from './samplers/lumigoSampler';

const lumigoEndpoint = process.env.LUMIGO_ENDPOINT || DEFAULT_LUMIGO_ENDPOINT;

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
      require(join(dirname(__dirname), 'package.json')) ||
      require(join(__dirname, 'package.json')) ||
      'unknown';

    const ignoredHostnames = [new URL(lumigoEndpoint).hostname];
    if (lumigoEndpoint != DEFAULT_LUMIGO_ENDPOINT) {
      ignoredHostnames.push(new URL(DEFAULT_DEPENDENCIES_ENDPOINT).hostname);
    }

    const instrumentationsToInstall = [
      new LumigoAmqplibInstrumentation(),
      new LumigoExpressInstrumentation(),
      new LumigoGrpcInstrumentation(),
      new LumigoFastifyInstrumentation(),
      new LumigoHttpInstrumentation(...ignoredHostnames),
      new LumigoIORedisInstrumentation(),
      new LumigoKafkaJsInstrumentation(),
      new LumigoMongoDBInstrumentation(),
      new LumigoPrismaInstrumentation(),
      new LumigoRedisInstrumentation(),
      new LumigoAwsSdkLibInstrumentation(),
    ].filter((i) => i.isApplicable());

    /*
     * Register instrumentation globally, so that all tracer providers
     * will receive traces. This may be necessary when there is already
     * built-in instrumentation in the app.
     */
    registerInstrumentations({
      instrumentations: instrumentationsToInstall.map((i) => i.getInstrumentation()),
    });

    const instrumentedModules = instrumentationsToInstall.map((i) => i.getInstrumentedModule());

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
    const infrastructureResource = Resource.default().merge(
      await detectResources({
        detectors: infrastructureDetectors,
      })
    );

    const framework = instrumentedModules.includes('express') ? 'express' : 'node';

    const resource = new Resource({
      framework,
    })
      .merge(infrastructureResource)
      .merge(await new ProcessEnvironmentDetector().detect());

    const tracerProvider = new NodeTracerProvider({
      sampler: getLumigoSampler(),
      resource,
      spanLimits: {
        attributeValueLengthLimit: getSpanAttributeMaxLength(),
      },
    });

    if (process.env.LUMIGO_DEBUG_SPANDUMP) {
      tracerProvider.addSpanProcessor(
        new SimpleSpanProcessor(new FileSpanExporter(process.env.LUMIGO_DEBUG_SPANDUMP))
      );
    }

    let reportDependencies: Promise<void | Object>;
    if (lumigoToken) {
      const otlpExporter = new OTLPTraceExporter({
        url: lumigoEndpoint,
        headers: {
          Authorization: `LumigoToken ${lumigoToken.trim()}`,
        },
      });

      tracerProvider.addSpanProcessor(
        new LumigoSpanProcessor(otlpExporter, {
          // The maximum queue size. After the size is reached spans are dropped.
          maxQueueSize: 1000,
          // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
          maxExportBatchSize: 100,
        })
      );

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

    tracerProvider.register({
      propagator: new LumigoW3CTraceContextPropagator(),
    });

    logger.info(`Lumigo OpenTelemetry Distro v${distroVersion} started.`);

    return {
      tracerProvider,
      reportDependencies,
      instrumentedModules,
    };
  } catch (err) {
    reportInitError(err);
    throw err;
  }
};
