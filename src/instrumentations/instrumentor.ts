import type { Instrumentation } from '@opentelemetry/instrumentation';
import { canRequireModule } from '../utils';

abstract class Instrumentor<T extends Instrumentation> {
  abstract getInstrumentedModule(): string;

  abstract getInstrumentation(options?): T;

  isApplicable() {
    return canRequireModule(this.getInstrumentedModule());
  }
}

export abstract class LoggingInstrumentor<T extends Instrumentation> extends Instrumentor<T> {
  override isApplicable() {
    return process.env.LUMIGO_ENABLE_LOGS?.toLowerCase() === 'true' && super.isApplicable();
  }
}

export abstract class TracingInstrumentor<T extends Instrumentation> extends Instrumentor<T> {
  override isApplicable() {
    // Since tracing is on by default, we allow omitting it and consider it enabled
    const tracingEnabled =
      process.env.LUMIGO_ENABLE_TRACES === undefined ||
      process.env.LUMIGO_ENABLE_TRACES.toLowerCase() === 'true';
    return tracingEnabled && super.isApplicable();
  }
}
