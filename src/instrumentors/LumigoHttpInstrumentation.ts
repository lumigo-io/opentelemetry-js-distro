import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

import { HttpHooks } from '../hooks/http';
import { fetchMetadataUri } from '../utils';

let metadata;

fetchMetadataUri().then((res) => (metadata = res));

export default class LumigoHttpInstrumentation {
  constructor(lumigoToken = '', urlsToIgnore: string[]) {
    return new HttpInstrumentation({
      ignoreOutgoingUrls: urlsToIgnore,
      applyCustomAttributesOnSpan: (span) => {
        if (metadata) span.setAttribute('metadata', JSON.stringify(metadata));
        if (lumigoToken) span.setAttribute('lumigoToken', lumigoToken);
      },
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
  }
}
