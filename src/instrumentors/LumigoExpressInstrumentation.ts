import { ExpressHooks } from '../hooks/express';
import { ExpressInstrumentation } from 'opentelemetry-instrumentation-express';

export default class LumigoExpressInstrumentation {
  constructor() {
    new ExpressInstrumentation({
      requestHook: ExpressHooks.requestHook,
      includeHttpAttributes: true,
    });
  }
}
