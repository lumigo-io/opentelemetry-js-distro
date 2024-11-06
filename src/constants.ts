export const LUMIGO_LOGGING_NAMESPACE = '@lumigo/opentelemetry';

export const DEFAULT_LUMIGO_TRACES_ENDPOINT =
  'https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/traces';

export const DEFAULT_LUMIGO_LOGS_ENDPOINT =
  'https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/logs';

export const DEFAULT_DEPENDENCIES_ENDPOINT =
  'https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/dependencies';

// Since tracing is on by default, we allow omitting it and consider it enabled
export const TRACING_ENABLED =
  process.env.LUMIGO_ENABLE_TRACES === undefined ||
  process.env.LUMIGO_ENABLE_TRACES?.toLowerCase() === 'true';

export const LOGGING_ENABLED = process.env.LUMIGO_ENABLE_LOGS?.toLowerCase() === 'true';
