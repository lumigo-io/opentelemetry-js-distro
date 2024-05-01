import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { Instrumentor } from '../instrumentor';

export default class LumigoPgInstrumentation extends Instrumentor<PgInstrumentation> {
  override isApplicable(): boolean {
    return (
      super.isApplicable() &&
      process.env.LUMIGO_DISABLE_PG_INSTRUMENTATION?.toLocaleLowerCase() === 'false'
    );
  }

  getInstrumentedModule(): string {
    return 'pg';
  }

  getInstrumentation(): PgInstrumentation {
    return new PgInstrumentation({
      enhancedDatabaseReporting: true,
    });
  }
}
