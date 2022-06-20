import { HttpHooks } from '../hooks/http';

import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

export default class LumigoHttpInstrumentation {
  constructor(lumigoEndpoint: string) {
    const ignoreOutgoingUrls = [lumigoEndpoint]
    if (process.env['ECS_CONTAINER_METADATA_URI_V4']) {
      ignoreOutgoingUrls.concat(process.env['ECS_CONTAINER_METADATA_URI_V4'])
    }
    if (process.env['ECS_CONTAINER_METADATA_URI']) {
      ignoreOutgoingUrls.concat(process.env['ECS_CONTAINER_METADATA_URI'])
    }

    return new HttpInstrumentation({
      ignoreOutgoingUrls: ignoreOutgoingUrls,
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
  }
}
