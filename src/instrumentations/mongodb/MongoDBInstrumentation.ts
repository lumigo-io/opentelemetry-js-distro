import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { TracingInstrumentor } from '../instrumentor';

export default class LumigoMongoDBInstrumentation extends TracingInstrumentor<MongoDBInstrumentation> {
  getInstrumentedModule(): string {
    return 'mongodb';
  }

  getInstrumentation(): MongoDBInstrumentation {
    return new MongoDBInstrumentation({
      enhancedDatabaseReporting: true,
    });
  }
}
