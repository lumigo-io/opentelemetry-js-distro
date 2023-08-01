import { isString, safeExecute } from '@lumigo/node-core/lib/utils';

export const PAYLOAD_MAX_SIZE = 2048;

export const concatenatePayload = (aggData: string, currData: unknown): string => {
  return safeExecute(
    () => {
      if (aggData.length >= PAYLOAD_MAX_SIZE) {
        return aggData;
      }
      const currDataStr = isString(currData) ? currData : JSON.stringify(currData);
      return (aggData + currDataStr).substring(0, PAYLOAD_MAX_SIZE);
    },
    'gRPC concatenate payloads',
    'WARNING',
    aggData
  )();
};
