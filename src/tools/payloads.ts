import { payloadStringify, ScrubContext } from '@lumigo/node-core';
import { logger } from '../logging';
import { getSpanAttributeMaxLength } from '../utils';

export const contentType = (
  headers: NodeJS.Dict<number | string | string[]>
): string | undefined => {
  if (!headers) {
    return undefined;
  }

  let contentType = headers['content-type']?.toString();
  if (!contentType) {
    // Double-check wether maybe the library does not normalize header names to lowercase
    const key = Object.keys(headers).find((name) => 'content-type' === name.toLowerCase());
    contentType = String(headers[key]);
  }

  return contentType;
};

export const scrubHttpPayload = (
  payload: any,
  contentType = 'text/plain',
  scrubContext: ScrubContext,
  maxScrubbedPayloadSize = getSpanAttributeMaxLength()
): string => {
  if (contentType?.startsWith('application/json')) {
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (err) {
        // Cannot parse payload, do best effort scrubbing
        logger.debug(
          "Cannot JSON parse payload with content type 'application/json', scrubbing may not be accurate"
        );
      }
    }

    return payloadStringify(payload, scrubContext, maxScrubbedPayloadSize);
  }

  if (typeof payload === 'string') {
    // It's a non-empty string, stringify it to make sure that it is clear it is a string in Lumigo.
    return payload.length > 0
      ? payloadStringify(payload, scrubContext, maxScrubbedPayloadSize)
      : undefined;
  }

  if (typeof payload === 'object' && payload !== null) {
    // Objects need to be stringified if neither null nor empty.
    let stringify = Array.isArray(payload);
    if (Array.isArray(payload)) {
      stringify = payload.length > 0;
    } else {
      stringify = Object.keys(payload).length > 0;
    }

    return stringify ? payloadStringify(payload, scrubContext, maxScrubbedPayloadSize) : undefined;
  }

  if (Number.isNaN(payload)) {
    return 'NaN';
  }

  switch (payload) {
    case null:
      return 'null';
    case undefined:
      return 'undefined';
    default:
      return payload?.toString() || '';
  }
};
