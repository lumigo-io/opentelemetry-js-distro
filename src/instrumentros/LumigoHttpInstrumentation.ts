import { HttpHooks } from '../hooks/http';

const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
import axios, { AxiosResponse } from 'axios';
import {LUMIGO_ENDPOINT} from "../wrapper";

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
  constructor(lumigoToken?: string, endPoint?: string) {
    return new HttpInstrumentation({
      ignoreOutgoingUrls: process.env['ECS_CONTAINER_METADATA_URI']
        ? [process.env['ECS_CONTAINER_METADATA_URI'], endPoint, LUMIGO_ENDPOINT]
        : [endPoint, LUMIGO_ENDPOINT],
      applyCustomAttributesOnSpan: (span, request, response) => {
        if (metadata) span.setAttribute('metadata', JSON.stringify(metadata));
        if (lumigoToken) span.setAttribute('lumigoToken', lumigoToken);
      },
      requestHook: HttpHooks.requestHook,
      responseHook: HttpHooks.responseHook,
    });
  }
}
