import { Instrumentation } from '@opentelemetry/instrumentation';
import { canRequireModule, safeRequire } from '../utils';

export abstract class Instrumentor<T extends Instrumentation> {
  abstract getInstrumentedModules(): string[];

  abstract getInstrumentation(options?): T;

  isApplicable() {
    return this.getInstrumentedModules().some(canRequireModule);
  }
}
