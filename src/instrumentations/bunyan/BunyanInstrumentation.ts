import { BunyanInstrumentation } from '@opentelemetry/instrumentation-bunyan';
import { LoggingInstrumentor } from '../instrumentor';

export default class LumigoBunyanInstrumentation extends LoggingInstrumentor<BunyanInstrumentation> {
  getInstrumentedModule(): string {
    return 'bunyan';
  }

  getInstrumentation(): BunyanInstrumentation {
    return new BunyanInstrumentation();
  }
}
