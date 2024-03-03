import { ExpressHooks } from './express';
import { ExpressInstrumentation } from 'opentelemetry-instrumentation-express';
import { Instrumentor } from '../instrumentor';

export default class LumigoExpressInstrumentation extends Instrumentor<ExpressInstrumentation> {
  getInstrumentedModules(): string[] {
    return ['express'];
  }

  getInstrumentation(): ExpressInstrumentation {
    return new ExpressInstrumentation({
      requestHook: ExpressHooks.requestHook,
      includeHttpAttributes: true,
    });
  }
}
