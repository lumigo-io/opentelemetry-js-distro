import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
// Setting the default Global logger to use the Console
// And optionally change the logging level (Defaults to INFO)
import LumigoHttpInstrumentation from './instrumentros/LumigoHttpInstrumentation';
import LumigoExpressInstrumentation from './instrumentros/LumigoExpressInstrumentation';
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { Resource } from "@opentelemetry/resources";
import { CollectorTraceExporter } from "@opentelemetry/exporter-collector";
const logLevel =
  (process.env.LUMIGO_DEBUG || 'false').toLowerCase() === 'true'
    ? DiagLogLevel.ALL
    : DiagLogLevel.ERROR;
diag.setLogger(new DiagConsoleLogger(), logLevel);
export const LUMIGO_ENDPOINT =
  'http://lumigo-wrapper-collector.golumigo.com:55681/v1/trace' || process.env.LUMIGO_ENDPOINT;

export const getTracerInfo = (): { name: string; version: string } => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../package.json');
  const { name, version } = pkg;
  return { name, version };
};

function requireIfAvailable(name) {
  try {
    require.resolve(name);
    require(name);
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.warn(`module [${name}] not installed`);
    }
  }
}

const trace = (lumigoToken: string, serviceName: string, endpoint = LUMIGO_ENDPOINT) => {
  try {
    if (process.env.LUMIGO_SWITCH_OFF && process.env.LUMIGO_SWITCH_OFF.toLowerCase() === 'true') {
      diag.debug('Lumigo is switched off');
      return;
    }
    const exporter = new CollectorTraceExporter({
    // @ts-ignore
      serviceName,
      url: endpoint,
    });
    const config = {
      resource: new Resource({
        lumigoToken: lumigoToken.trim(),
        'service.name': serviceName,
        runtime: `node${process.version}`,
        tracerVersion: getTracerInfo().version,
        framework: 'express',
        envs: JSON.stringify(process.env),
      }),
    };
    const traceProvider = new NodeTracerProvider(config);
    traceProvider.addSpanProcessor(new BatchSpanProcessor(exporter));
    traceProvider.register();

    registerInstrumentations({
      instrumentations: [
        // @ts-ignore
        new LumigoHttpInstrumentation(lumigoToken, endpoint),
        // @ts-ignore
        new LumigoExpressInstrumentation(),
      ],
    });
    requireIfAvailable('express');
    requireIfAvailable('http');
    requireIfAvailable('https');
    diag.debug('Lumigo instrumentation started');
  } catch (e) {
    console.error('Lumigo tracer had an Error: ', e);
  }
};

if (process.env.LUMIGO_TOKEN && process.env.LUMIGO_SERVICE_NAME) {
  trace(
    process.env.LUMIGO_TOKEN,
    process.env.LUMIGO_SERVICE_NAME,
    process.env.LUMIGO_ENDPOINT || LUMIGO_ENDPOINT
  );
}

module.exports = {
  trace,
  LumigoHttpInstrumentation,
  LumigoExpressInstrumentation,
  LumigoInstrumentations: (lumigoToken?: string) => [
    new LumigoHttpInstrumentation(lumigoToken),
    new LumigoExpressInstrumentation(),
  ],
};
