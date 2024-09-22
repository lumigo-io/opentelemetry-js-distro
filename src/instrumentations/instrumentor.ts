import type { Instrumentation } from '@opentelemetry/instrumentation';
import { canRequireModule } from '../utils';
import { LOGGING_ENABLED, TRACING_ENABLED } from '../constants';

abstract class Instrumentor<T extends Instrumentation> {
  abstract getInstrumentedModule(): string;

  abstract getInstrumentation(options?): T;

  isApplicable() {
    return canRequireModule(this.getInstrumentedModule());
  }
}

export abstract class LoggingInstrumentor<T extends Instrumentation> extends Instrumentor<T> {
  override isApplicable() {
    return LOGGING_ENABLED && super.isApplicable();
  }
}

export abstract class TracingInstrumentor<T extends Instrumentation> extends Instrumentor<T> {
  override isApplicable() {
    return TRACING_ENABLED && super.isApplicable();
  }
}
