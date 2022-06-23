import { isEncodingType, safeExecute } from '../utils';

export const isValidHttpRequestBody = (reqBody) =>
  !!(reqBody && (typeof reqBody === 'string' || reqBody instanceof Buffer));

export const extractBodyFromEmitSocketEvent = (socketEventArgs) => {
  return safeExecute(() => {
    if (socketEventArgs && socketEventArgs._httpMessage && socketEventArgs._httpMessage._hasBody) {
      const httpMessage = socketEventArgs._httpMessage;
      let lines = [];
      if (httpMessage.hasOwnProperty('outputData')) {
        if (
          Array.isArray(httpMessage.outputData) &&
          httpMessage.outputData.length > 0 &&
          httpMessage.outputData[0].hasOwnProperty('data') &&
          typeof httpMessage.outputData[0].data === 'string'
        ) {
          lines = httpMessage.outputData[0].data.split('\n');
        } else {
          console.warn('Unexpected httpMessage.outputData value:', httpMessage.outputData);
        }
      } else if (httpMessage.hasOwnProperty('output')) {
        if (
          Array.isArray(httpMessage.output) &&
          httpMessage.output.length > 0 &&
          typeof httpMessage.output[0] === 'string'
        ) {
          lines = httpMessage.output[0].split('\n');
        } else {
          console.warn('Unexpected httpMessage.output value:', httpMessage.output);
        }
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
        ? Buffer(writeEventArgs[0]).toString(encoding)
        : writeEventArgs[0].toString();
    }
  })();
};
