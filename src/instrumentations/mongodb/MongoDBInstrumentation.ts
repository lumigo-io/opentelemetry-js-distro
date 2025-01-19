import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { TracingInstrumentor } from '../instrumentor';

export default class LumigoMongoDBInstrumentation extends TracingInstrumentor<MongoDBInstrumentation> {
  override isApplicable(): boolean {
    return (
      super.isApplicable() &&
      process.env.LUMIGO_DISABLE_MONGODB_INSTRUMENTATION?.toLocaleLowerCase() !== 'true'
    );
  }
  getInstrumentedModule(): string {
    return 'mongodb';
  }

  getInstrumentation(): MongoDBInstrumentation {
    return new MongoDBInstrumentation({
      enhancedDatabaseReporting: true,
    });
  }
}
