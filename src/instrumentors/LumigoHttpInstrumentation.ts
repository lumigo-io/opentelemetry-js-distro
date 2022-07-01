import { HttpInstrumentation, IgnoreMatcher } from '@opentelemetry/instrumentation-http';

import { HttpHooks } from '../hooks/http';
import { fetchMetadataUri } from '../utils';

let metadata;

fetchMetadataUri().then((res) => (metadata = res));

export default class LumigoHttpInstrumentation {
  constructor(urlsToIgnore: IgnoreMatcher[]) {
    return new HttpInstrumentation({
      ignoreOutgoingUrls: urlsToIgnore,
      ignoreIncomingPaths: urlsToIgnore,
      applyCustomAttributesOnSpan: (span) => {
        if (metadata) span.setAttribute('metadata', JSON.stringify(metadata));
      },
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
  }
}
