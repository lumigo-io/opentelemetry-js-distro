import { isString, safeExecute } from '@lumigo/node-core/lib/utils';

export const PAYLOAD_MAX_SIZE = 2048;

export const concatenatePayload = (aggregatedData: string, currentData: unknown): string => {
  return safeExecute(
    () => {
      if (aggregatedData.length >= PAYLOAD_MAX_SIZE) {
        return aggregatedData;
      }
      const currDataStr = isString(currentData) ? currentData : JSON.stringify(currentData);
      return (aggregatedData + currDataStr).substring(0, PAYLOAD_MAX_SIZE);
    },
    'gRPC concatenate payloads',
    'WARNING',
    aggregatedData
  )();
};
