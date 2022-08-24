import { safeRequire } from '../utils';
import { InstrumentationBase } from '@opentelemetry/instrumentation';

export abstract class Instrumentor<T> {
  abstract getInstrumentationId(): string;
  abstract getInstrumentation(options?): T;

  requireIfAvailable(): string {
    return safeRequire(this.getInstrumentationId());
  }
}
