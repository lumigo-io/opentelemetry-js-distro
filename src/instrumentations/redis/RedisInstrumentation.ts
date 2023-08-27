import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { Instrumentor } from '../instrumentor';

export default class LumigoRedisInstrumentation extends Instrumentor<RedisInstrumentation> {
  getInstrumentedModule(): string {
    return 'redis';
  }

  getInstrumentation(): RedisInstrumentation {
    return new RedisInstrumentation();
  }
}
