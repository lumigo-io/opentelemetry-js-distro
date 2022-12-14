import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';

import { sortify } from './tools/jsonSortify';
import { diag, DiagLogger } from '@opentelemetry/api';

const DEFAULT_MAX_ENTRY_SIZE = 2048;
export const DEFAULT_CONNECTION_TIMEOUT = 300;

interface HttpHeaders {
  [key: string]: string;
}

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

export const getProtocolModuleForUri = (uri: string) => {
  return uri.indexOf('https') === 0 ? https : http;
};

/**
 * This function return the environment variables by total max size of the values of each environment variable key.
 * For example: if max size=2, environment variables ={"key_1": "value1", "key_2": "value_2"}, return {"key_1": "value1"}.
 */
export const extractEnvVars = () => {
  const res = {};
  const maxSize = getMaxSize();
  let length = 0;
  Object.entries(process.env).forEach(([key, value]) => {
    if (length + value.length <= maxSize) {
      res[key] = value;
      length += value.length;
    }
  });
  return res;
};

export const postUri = async (
  url: string,
  data: Object,
  headers: HttpHeaders = {}
): Promise<Object> => {
  const jsonData = JSON.stringify(data);

  headers['Content-Type'] = 'application/x-www-form-urlencoded';
  headers['Content-Length'] = String(jsonData.length);

  const parsedUrl = new URL(url);

  const responseBody = await new Promise((resolve, reject) => {
    const request = getProtocolModuleForUri(url).request(
      {
        method: 'POST',
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname,
        headers,
      },
      (response) => {
        if (response.statusCode >= 400) {
          reject(`Request to '${url}' failed with status ${response.statusCode}`);
        }
        let responseBody = '';
        response.on('data', (chunk) => (responseBody += chunk.toString()));
        // All the data has been read, resolve the Promise
        response.on('end', () => resolve(responseBody));
      }
    );
    // Set an aggressive timeout to prevent lock-ups
    request.setTimeout(getConnectionTimeout(), () => {
      request.destroy();
    });
    // Connection error, disconnection, etc.
    request.on('error', reject);
    request.write(jsonData);
    request.end();
  });

  return JSON.parse(responseBody.toString());
};

export const getUri = async (uri: string): Promise<Object> => {
  const responseBody = await new Promise((resolve, reject) => {
    const request = getProtocolModuleForUri(uri).get(uri, (response) => {
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

export const logger: DiagLogger = diag.createComponentLogger({
  namespace: '@lumigo/opentelemetry:',
});

export const safeRequire = (libId) => {
  try {
    const customReq =
      // eslint-disable-next-line no-undef,camelcase
      // @ts-ignore __non_webpack_require__ not available at compile time
      typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
    return customReq(libId);
  } catch (e) {
    try {
      const customReq =
        // eslint-disable-next-line no-undef,camelcase
        // @ts-ignore __non_webpack_require__ not available at compile time
        typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
      const path = customReq.resolve(libId, {
        paths: (process.env.NODE_PATH || '').split(':'),
      });
      return customReq(path);
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') {
        logger.warn('Unable to load module', {
          error: e,
          libId: libId,
        });
      }
    }
  }
  return undefined;
};

export const getMaxSize = () => {
  return (
    parseInt(process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT) ||
    parseInt(process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT) ||
    DEFAULT_MAX_ENTRY_SIZE
  );
};
