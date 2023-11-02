import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { Instrumentor } from '../instrumentor';
import { FastifyHooks } from './fastify';

export default class LumigoFastifyInstrumentation extends Instrumentor<FastifyInstrumentation> {
  getInstrumentedModule(): string {
    return 'fastify';
  }

  getInstrumentation(): FastifyInstrumentation {
    return new FastifyInstrumentation({
      requestHook: FastifyHooks.requestHook,
    });
  }
}
