import { BunyanInstrumentation } from '@opentelemetry/instrumentation-bunyan';
import { Instrumentor } from '../instrumentor';

export default class LumigoBunyanInstrumentation extends Instrumentor<BunyanInstrumentation> {
  getInstrumentedModule(): string {
    return 'bunyan';
  }

  getInstrumentation(): BunyanInstrumentation {
    return new BunyanInstrumentation();
  }

  override isApplicable(): boolean {
    return (
      super.isApplicable() &&
      process.env.LUMIGO_LOGS_ENABLED?.toLowerCase() === 'true'
    );
  }
}
