import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

import { HttpHooks } from '../hooks/http';
import { fetchMetadataUri } from '../utils';

let metadata;

fetchMetadataUri().then((res) => (metadata = res));

export default class LumigoHttpInstrumentation {
  constructor(urlsToIgnore: string[]) {
    return new HttpInstrumentation({
      ignoreOutgoingUrls: urlsToIgnore,
      applyCustomAttributesOnSpan: (span) => {
        if (metadata) span.setAttribute('metadata', JSON.stringify(metadata));
      },
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
  }
}
