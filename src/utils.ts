import * as crypto from 'crypto';
import { sortify } from './tools/jsonSortify';
('["secretsmanager.*.amazonaws.com", "ssm.*.amazonaws.com", "kms.*.amazonaws.com", "sts..*amazonaws.com"]');

export function safeExecute<T>(
  callback: Function,
  message: string = 'Error in Lumigo tracer',
  logLevel: string = 'warn',
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

export const safeGet = (obj, arr, dflt = null) => {
  let current = obj;
  for (let i in arr) {
    if (!current) {
      return dflt;
    }
    current = current[arr[i]];
  }
  return current || dflt;
};

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
    let obj = {};
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

// eslint-disable-next-line no-unused-vars
const recursiveGetKeyByDepth = (event, keyToSearch, maxDepth) => {
  if (maxDepth === 0) {
    return undefined;
  }
  let foundValue = undefined;
  const examineKey = (k) => {
    if (k === keyToSearch) {
      foundValue = event[k];
      return true;
    }
    if (event[k] && typeof event[k] === 'object') {
      foundValue = recursiveGetKeyByDepth(event[k], keyToSearch, maxDepth - 1);
      return foundValue !== undefined;
    }
  };
  Object.keys(event).some(examineKey);
  return foundValue;
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
