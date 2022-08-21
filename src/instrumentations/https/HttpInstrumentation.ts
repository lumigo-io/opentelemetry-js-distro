import { HttpInstrumentation, IgnoreMatcher } from '@opentelemetry/instrumentation-http';

import { HttpHooks } from './http';
import { Instrumentor } from '../instrumentor';

export default class LumigoHttpInstrumentation extends Instrumentor {
  getInstrumentationId(): string {
    return 'http';
  }

  getInstrumentation(urlsToIgnore: IgnoreMatcher[]) {
    return new HttpInstrumentation({
      ignoreOutgoingUrls: urlsToIgnore,
      ignoreIncomingPaths: urlsToIgnore,
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
  }
}
