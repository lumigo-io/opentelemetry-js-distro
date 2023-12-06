import { isEncodingType, safeExecute } from '../utils';

export const isValidHttpRequestBody = (reqBody) =>
  !!(reqBody && (typeof reqBody === 'string' || reqBody instanceof Buffer));

export const extractBodyFromEmitSocketEvent = (socketEventArgs) => {
  return safeExecute(() => {
    if (socketEventArgs && socketEventArgs._httpMessage && socketEventArgs._httpMessage._hasBody) {
      const httpMessage = socketEventArgs._httpMessage;
      let lines = [];
      if (httpMessage.hasOwnProperty('outputData')) {
        lines = httpMessage.outputData?.[0]?.data?.split('\n');
      } else if (httpMessage.hasOwnProperty('output')) {
        lines = httpMessage.output?.[0]?.split('\n');
      }
      if (lines.length > 0) {
        return lines[lines.length - 1];
      }
    }
  })();
};

export const extractBodyFromWriteOrEndFunc = (writeEventArgs) => {
  return safeExecute(() => {
    if (isValidHttpRequestBody(writeEventArgs[0])) {
      const encoding = isEncodingType(writeEventArgs[1]) ? writeEventArgs[1] : 'utf8';
      return typeof writeEventArgs[0] === 'string'
        ? Buffer.from(writeEventArgs[0]).toString(encoding)
        : writeEventArgs[0].toString();
    }
  })();
};

/**
 * Formats a raw url string by:
 * * removing empty path "/" path - "https://example.com/" -> "https://example.com"
 * * removing port if not standard - "https://example.com:443" -> "https://example.com"
 * @param raw_url
 * @returns string formatted url
 */
export const standardizeHttpUrl = (raw_url) => {
  const parsedUrl = new URL(raw_url);
  const path = parsedUrl.pathname && parsedUrl.pathname !== '/' ? parsedUrl.pathname : '';
  return `${parsedUrl.protocol}//${parsedUrl.host}${path}${parsedUrl.search}`;
}
