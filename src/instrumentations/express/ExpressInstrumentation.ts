import { ExpressHooks } from './express';
import { ExpressInstrumentation } from 'opentelemetry-instrumentation-express';
import { Instrumentor } from '../instrumentor';
import { InstrumentationBase } from '@opentelemetry/instrumentation';

export default class LumigoExpressInstrumentation extends Instrumentor {
  getInstrumentationId(): string {
    return 'express';
  }

  getInstrumentation(): InstrumentationBase {
    return new ExpressInstrumentation({
      requestHook: ExpressHooks.requestHook,
      includeHttpAttributes: true,
    });
  }
}
