import { HttpInstrumentation, IgnoreMatcher } from '@opentelemetry/instrumentation-http';

import { HttpHooks } from '../hooks/http';

export default class LumigoHttpInstrumentation {
  constructor(urlsToIgnore: IgnoreMatcher[]) {
    return new HttpInstrumentation({
      ignoreOutgoingUrls: urlsToIgnore,
      ignoreIncomingPaths: urlsToIgnore,
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
  }
}
