import { safeRequire } from '../utils';

export abstract class Instrumentor<T> {
  abstract getInstrumentationId(): string;
  abstract getInstrumentation(options?): T;

  requireIfAvailable(): string {
    return safeRequire(this.getInstrumentationId());
  }
}
