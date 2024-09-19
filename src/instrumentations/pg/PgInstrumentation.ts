import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { TracingInstrumentor } from '../instrumentor';

export default class LumigoPgInstrumentation extends TracingInstrumentor<PgInstrumentation> {
  override isApplicable(): boolean {
    return (
      super.isApplicable() &&
      process.env.LUMIGO_DISABLE_PG_INSTRUMENTATION?.toLocaleLowerCase() !== 'true'
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
