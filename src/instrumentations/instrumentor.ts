import { canRequireModule, safeRequire } from '../utils';

export abstract class Instrumentor<T> {
  abstract getInstrumentedModule(): string;

  abstract getInstrumentation(options?): T;

  isApplicable = () => canRequireModule(this.getInstrumentedModule());

  requireIfAvailable(): string {
    return safeRequire(this.getInstrumentedModule());
  }
}
