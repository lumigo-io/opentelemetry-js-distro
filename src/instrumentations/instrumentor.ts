import { Instrumentation } from '@opentelemetry/instrumentation';
import { canRequireModule, safeRequire } from '../utils';

export abstract class Instrumentor<T extends Instrumentation> {
  abstract getInstrumentedModule(): string;

  abstract getInstrumentation(options?): T;

  isApplicable() {
    return canRequireModule(this.getInstrumentedModule());
  }
}
