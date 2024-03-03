import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { Instrumentor } from '../instrumentor';

export default class LumigoMongoDBInstrumentation extends Instrumentor<MongoDBInstrumentation> {
  getInstrumentedModules(): string[] {
    return ['mongodb'];
  }

  getInstrumentation(): MongoDBInstrumentation {
    return new MongoDBInstrumentation({
      enhancedDatabaseReporting: true,
    });
  }
}
