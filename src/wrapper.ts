import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import LumigoHttpInstrumentation from './instrumentros/LumigoHttpInstrumentation';
import LumigoExpressInstrumentation from './instrumentros/LumigoExpressInstrumentation';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { InstrumentationBase, registerInstrumentations } from '@opentelemetry/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { safeExecute } from './utils';
console.log('process.env', process.env);
const logLevel =
  (process.env.LUMIGO_DEBUG || 'false').toLowerCase() === 'true'
    ? DiagLogLevel.ALL
    : DiagLogLevel.ERROR;
diag.setLogger(new DiagConsoleLogger(), logLevel);
export const LUMIGO_ENDPOINT =
  'http://lumigo-wrapper-collector.golumigo.com:55681/v1/trace' || process.env.LUMIGO_ENDPOINT;

let isTraced = false;

const MODULES_TO_INSTRUMENT = ['express', 'http', 'https'];

const externalInstrumentations = [];

export const addInstrumentation = (instrumentation: InstrumentationBase) => {
  if (isTraced) {
    console.warn(
      `Lumigo already traced, Try to first add your instrumentation and then calling trace()`
    );
  } else if (instrumentation instanceof InstrumentationBase) {
    externalInstrumentations.push(instrumentation);
  } else {
    console.warn(`instrumentation is not instance of InstrumentationBase`);
  }
};

export const getTracerInfo = (): { name: string, version: string } => {
  return safeExecute(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('../package.json');
      const { name, version } = pkg;
      return { name, version };
    },
    'Failed to get wrapper version',
    'warn',
    { name: '@lumigo/microservices-node-tracer', version: '0.0.0' }
  )();
};

function requireIfAvailable(names: string[]) {
  names.forEach((name) => {
    try {
      require.resolve(name);
      require(name);
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        console.warn(`module [${name}] not installed`);
      }
    }
  });
}

export const trace = (lumigoToken: string, serviceName: string, endpoint = LUMIGO_ENDPOINT) => {
  try {
    if (process.env.LUMIGO_SWITCH_OFF && process.env.LUMIGO_SWITCH_OFF.toLowerCase() === 'true') {
      diag.debug('Lumigo is switched off');
      return;
    }
    if (isTraced) {
      diag.debug('Lumigo already traced');
      return;
    }
    const exporter = new OTLPTraceExporter({
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
        ...externalInstrumentations,
      ],
    });
    requireIfAvailable([
      ...MODULES_TO_INSTRUMENT,
      ...JSON.parse(process.env.MODULES_TO_INSTRUMENT || '[]'),
    ]);
    isTraced = true;
    diag.debug('Lumigo instrumentation started');
  } catch (e) {
    console.error('Lumigo tracer had an Error: ', e);
  }
};

if (process.env.LUMIGO_TOKEN && process.env.LUMIGO_SERVICE_NAME && !isTraced) {
  trace(
    process.env.LUMIGO_TOKEN,
    process.env.LUMIGO_SERVICE_NAME,
    process.env.LUMIGO_ENDPOINT || LUMIGO_ENDPOINT
  );
}
