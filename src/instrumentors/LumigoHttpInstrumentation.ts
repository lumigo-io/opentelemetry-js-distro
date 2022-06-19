import { HttpHooks } from '../hooks/http';

import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import axios, { AxiosResponse } from 'axios';

let metadata;

const fetchMetadataUri = async (): Promise<AxiosResponse> => {
  try {
    const metadataUri = process.env['ECS_CONTAINER_METADATA_URI'];
    if (metadataUri) {
      return axios.get(metadataUri);
    } else {
      console.warn('Missing ECS metadata...');
      return Promise.resolve(undefined);
    }
  } catch (e) {
    return undefined;
  }
};
fetchMetadataUri().then((res) => {
  metadata = res?.data;
});

export default class LumigoHttpInstrumentation {
  constructor(lumigoEndpoint: string) {
    const ignoreOutgoingUrls = [lumigoEndpoint]
    if (process.env['ECS_CONTAINER_METADATA_URI']) {
      ignoreOutgoingUrls.concat(process.env['ECS_CONTAINER_METADATA_URI'])
    }

    return new HttpInstrumentation({
      ignoreOutgoingUrls: ignoreOutgoingUrls,
      applyCustomAttributesOnSpan: (span) => {
        // TODO Move metadata to resource detector
        if (metadata) span.setAttribute('metadata', JSON.stringify(metadata));
      },
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
  }
}
