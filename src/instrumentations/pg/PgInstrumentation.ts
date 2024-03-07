import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { Instrumentor } from '../instrumentor';

export default class LumigoPgInstrumentation extends Instrumentor<PgInstrumentation> {
  getInstrumentedModule(): string {
    return 'pg';
  }

  getInstrumentation(): PgInstrumentation {
    return new PgInstrumentation({
      enhancedDatabaseReporting: true,
    });
  }
}
