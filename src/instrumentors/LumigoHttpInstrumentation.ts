import { HttpHooks } from '../hooks/http';

import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { DEFAULT_LUMIGO_ENDPOINT } from '../wrapper';
import { fetchMetadataUri } from '../utils';

let metadata;

fetchMetadataUri().then((res) => {
  metadata = res?.data;
});

export default class LumigoHttpInstrumentation {
  constructor(lumigoToken = '', endPoint = DEFAULT_LUMIGO_ENDPOINT) {
    return new HttpInstrumentation({
      ignoreOutgoingUrls: process.env['ECS_CONTAINER_METADATA_URI']
        ? [process.env['ECS_CONTAINER_METADATA_URI'], endPoint, DEFAULT_LUMIGO_ENDPOINT]
        : [endPoint, DEFAULT_LUMIGO_ENDPOINT],
      applyCustomAttributesOnSpan: (span) => {
        if (metadata) span.setAttribute('metadata', JSON.stringify(metadata));
        if (lumigoToken) span.setAttribute('lumigoToken', lumigoToken);
      },
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
  }
}
