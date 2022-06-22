import * as crypto from 'crypto';

import { sortify } from './tools/jsonSortify';
import * as https from "https";

export const DEFAULT_CONNECTION_TIMEOUT = 300;

export function safeExecute<T>(
  callback: Function,
  message = 'Error in Lumigo tracer',
  logLevel = 'warn',
  defaultReturn: T = undefined
): Function {
  return function (...args) {
    try {
      return callback.apply(this, args);
    } catch (err) {
      console[logLevel](message, err);
      return defaultReturn;
    }
  };
}

export const isEncodingType = (encodingType): boolean =>
  !!(
    encodingType &&
    typeof encodingType === 'string' &&
    ['ascii', 'utf8', 'utf16le', 'ucs2', 'base64', 'binary', 'hex'].includes(encodingType)
  );

export const runOneTimeWrapper = (func: Function, context: any = undefined): Function => {
  let done = false;
  return (...args) => {
    if (!done) {
      const result = func.apply(context || this, args);
      done = true;
      return result;
    }
  };
};

export const getConnectionTimeout = () => {
  return parseInt(process.env['LUMIGO_CONNECTION_TIMEOUT']) || DEFAULT_CONNECTION_TIMEOUT;
};

const getUri = async (uri: string): Promise<Object> => {
  const responseBody = await new Promise((resolve, reject) => {
    const request = https.get(uri, (response) => {
      if (response.statusCode >= 400) {
        reject(`Request to '${uri}' failed with status ${response.statusCode}`);
      }

      /*
       * Concatenate the response out of chunks:
       * https://nodejs.org/api/stream.html#stream_event_data
       */
      let responseBody = '';
      response.on('data', (chunk) => (responseBody += chunk.toString()));
      // All the data has been read, resolve the Promise
      response.on('end', () => resolve(responseBody));
    });
    // Set an aggressive timeout to prevent lock-ups
    request.setTimeout(getConnectionTimeout(), () => {
      request.destroy();
    });
    // Connection error, disconnection, etc.
    request.on('error', reject);
    request.end();
  });

  return JSON.parse(responseBody.toString());
}

export const fetchMetadataUri = async (): Promise<Object> => {
  try {
    const metadataUri = process.env['ECS_CONTAINER_METADATA_URI'];
    if (metadataUri) {
      return getUri(metadataUri);
    } else {
      console.warn('Missing ECS metadata...');
      return Promise.resolve(undefined);
    }
  } catch (e) {
    return undefined;
  }
};

export const safeGet = (obj, arr, dflt = null) => {
  let current = obj;
  for (const i in arr) {
    if (!current) {
      return dflt;
    }
    current = current[arr[i]];
  }
  return current || dflt;
};

export const isEnvVarTrue = (envVar: string) =>
  process.env[envVar] && process.env[envVar].toLowerCase() === 'true';

export const isAwsService = (host, responseData = undefined): boolean => {
  if (host && host.includes('amazonaws.com')) {
    return true;
  }
  return !!(
    responseData &&
    responseData.headers &&
    (responseData.headers['x-amzn-requestid'] || responseData.headers['x-amz-request-id'])
  );
};

export const parseQueryParams = (queryParams) => {
  return safeExecute(() => {
    if (typeof queryParams !== 'string') return {};
    const obj = {};
    queryParams.replace(
      /([^=&]+)=([^&]*)/g,
      // @ts-ignore
      safeExecute((m, key, value) => {
        obj[decodeURIComponent(key)] = decodeURIComponent(value);
      }, 'Failed to parse a specific key in parseQueryParams')
    );
    return obj;
  }, 'Failed to parse query params')();
};

export const md5Hash = (item: {}): string | undefined => {
  try {
    const md5sum = crypto.createHash('md5');
    md5sum.update(sortify(item));
    return md5sum.digest('hex');
  } catch (err) {
    console.warn('Failed to hash item', err);
    return undefined;
  }
};

// @ts-ignore
export const removeDuplicates = (arr) => Array.from(new Set(arr));
