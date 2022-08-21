import { safeRequire } from '../utils';
import { InstrumentationBase } from '@opentelemetry/instrumentation';

export abstract class Instrumentor {
  abstract getInstrumentationId(): string;
  abstract getInstrumentation(options?): InstrumentationBase;

  requireIfAvailable(): string {
    return safeRequire(this.getInstrumentationId());
  }
}
