import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations, Instrumentation } from '@opentelemetry/instrumentation';
import { detectResources, envDetector, processDetector, Resource } from '@opentelemetry/resources';
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { report } from './dependencies';
import { FileSpanExporter } from './exporters';
import LumigoExpressInstrumentation from './instrumentations/express/ExpressInstrumentation';
import LumigoHttpInstrumentation from './instrumentations/https/HttpInstrumentation';
import LumigoMongoDBInstrumentation from './instrumentations/mongodb/MongoDBInstrumentation';
import { getSpanAttributeMaxLength } from './utils';
import * as awsResourceDetectors from '@opentelemetry/resource-detector-aws';
import { LumigoDistroDetector, LumigoKubernetesDetector, LumigoTagDetector } from './resources/detectors';
import { LumigoW3CTraceContextPropagator } from './propagator/w3cTraceContextPropagator';

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

const DEFAULT_LUMIGO_ENDPOINT = 'https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/traces';
const DEFAULT_DEPENDENCIES_ENDPOINT =
  'https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/dependencies';

import { logger } from './logging';
import { dirname, join } from 'path';
import { ProcessEnvironmentDetector } from './resources/detectors/ProcessEnvironmentDetector';

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

    const instrumentationsToInstall = [
      new LumigoHttpInstrumentation(new URL(lumigoEndpoint).hostname),
      new LumigoExpressInstrumentation(),
      new LumigoMongoDBInstrumentation(),
    ].filter((i) => i.isApplicable());

    /*
     * Register instrumentation globally, so that all tracer providers
     * will receive traces. This may be necessary when there is already
     * built-in instrumentation in the app.
     */
    registerInstrumentations({
      instrumentations: instrumentationsToInstall.map(
        (i) => i.getInstrumentation() as Instrumentation
      ),
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
        new BatchSpanProcessor(otlpExporter, {
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
      } else if (lumigoEndpoint === DEFAULT_LUMIGO_ENDPOINT) {
        /*
         * If the trace endpoint is different than the default, it could be
         * that this application does not have egress to Lumigo SaaS or it is
         * reporting to a backend that is not Lumigo, and thus does not have
         * the facilities to process the dependencies anyways. In this case,
         * skip the reporting, as it might not work and cause noise in the logs.
         *
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
