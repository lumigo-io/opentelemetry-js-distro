import { ClientRequest, IncomingMessage, ServerResponse } from 'http';
import * as shimmer from 'shimmer';
import { URL } from 'url';

import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import type { RequestRawData } from '@lumigo/node-core/lib/types/spans/httpSpan';
import type { Span } from '@opentelemetry/sdk-trace-base';
import {
  SEMATTRS_HTTP_HOST,
  SEMATTRS_HTTP_TARGET,
  SEMATTRS_NET_PEER_NAME,
} from '@opentelemetry/semantic-conventions';
import type { InstrumentationIfc } from '../hooksIfc';
import { logger } from '../../logging';
import { getAwsServiceData } from '../../spans/awsSpan';
import { runOneTimeWrapper, safeExecute, getSpanAttributeMaxLength } from '../../utils';
import { contentType, scrubHttpPayload } from '../../tools/payloads';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

const isFunctionAlreadyWrapped = (fn) => fn && fn.__wrapped;

export type HookOptions = {
  beforeHook?: Function;
  afterHook?: Function;
};

const hook = (module, funcName, options: HookOptions = {}, shimmerLib = shimmer) => {
  const { beforeHook = noop, afterHook = noop } = options;
  const safeBeforeHook = safeExecute(beforeHook, `before hook of ${funcName} fail`);
  const safeAfterHook = safeExecute(afterHook, `after hook of ${funcName} fail`);
  const extenderContext = {};
  try {
    const wrapper = (originalFn) => {
      if (isFunctionAlreadyWrapped(originalFn)) return originalFn;
      return function (...args) {
        safeBeforeHook.call(this, args, extenderContext);
        const originalFnResult = originalFn.apply(this, args);
        safeAfterHook.call(this, args, originalFnResult, extenderContext);
        return originalFnResult;
      };
    };
    shimmerLib.wrap(module, funcName, wrapper);
  } catch (e) {
    logger.warn(`Wrapping of function ${funcName} failed`, options);
  }
};

type OnRequestEndOptionsType = {
  body: string;
  headers: Record<string, string>;
  statusCode: number;
  truncated: boolean;
};

export const isValidHttpRequestBody = (reqBody) =>
  !!(reqBody && (typeof reqBody === 'string' || reqBody instanceof Buffer));

export const isEncodingType = (encodingType): boolean =>
  !!(
    encodingType &&
    typeof encodingType === 'string' &&
    ['ascii', 'utf8', 'utf16le', 'ucs2', 'base64', 'binary', 'hex'].includes(encodingType)
  );

export const isEmptyString = (str): boolean =>
  !!(!str || (typeof str === 'string' && str.length === 0));

type RequestType = (ClientRequest | IncomingMessage) & { headers?: any; getHeaders: () => any };

export const HttpHooks: InstrumentationIfc<
  ClientRequest | IncomingMessage,
  IncomingMessage | ServerResponse
> = {
  requestHook(span: Span & { attributes: Record<string, string> }, request: RequestType) {
    if (request instanceof ClientRequest) {
      safeExecute(() => {
        const requestData: RequestRawData = {
          request: {
            path: span.attributes?.[SEMATTRS_HTTP_TARGET],
            host:
              span.attributes?.[SEMATTRS_HTTP_HOST] || span.attributes?.[SEMATTRS_NET_PEER_NAME],
            truncated: false,
            body: '',
            headers: Http.getRequestHeaders(request),
          },
          response: {
            truncated: false,
            body: '',
            headers: {},
          },
        };
        const scrubbedHeaders = CommonUtils.payloadStringify(
          requestData.request.headers,
          ScrubContext.HTTP_REQUEST_HEADERS,
          getSpanAttributeMaxLength()
        );
        span.setAttribute('http.request.headers', scrubbedHeaders);
        const emitWrapper = Http.httpRequestEmitBeforeHookWrapper(requestData, span);

        const writeWrapper = Http.httpRequestWriteBeforeHookWrapper(requestData, span);

        const endWrapper = (requestData: RequestRawData, span: Span) => {
          return function (args) {
            if (isEmptyString(requestData.request.body)) {
              const body = Http.extractBodyFromWriteOrEndFunc(args);
              requestData.request.body += body;
              const scrubbed = scrubHttpPayload(
                requestData.request.body,
                contentType(requestData.request.headers),
                ScrubContext.HTTP_REQUEST_BODY
              );
              span.setAttribute('http.request.body', scrubbed);
            }
          };
        };

        hook(request, 'end', { beforeHook: endWrapper });
        hook(request, 'emit', { beforeHook: emitWrapper });
        hook(request, 'write', { beforeHook: writeWrapper });
      })();
    }
  },
  responseHook(span: Span, response: IncomingMessage | (ServerResponse & { headers?: any })) {
    const scrubbedHeaders = CommonUtils.payloadStringify(
      response.headers,
      ScrubContext.HTTP_RESPONSE_HEADERS,
      getSpanAttributeMaxLength()
    );
    if (response.headers) {
      span.setAttribute('http.response.headers', scrubbedHeaders);
    }
  },
};

export class Http {
  static onRequestEnd(span: Span & { attributes: Record<string, string> }) {
    return (requestRawData: RequestRawData, options: OnRequestEndOptionsType) => {
      const { body, headers, statusCode, truncated } = options;
      requestRawData.response.body = body;
      requestRawData.response.headers = headers;
      requestRawData.response.statusCode = statusCode;
      requestRawData.response.truncated = truncated;
      const scrubbed = scrubHttpPayload(
        requestRawData.response.body,
        contentType(headers),
        ScrubContext.HTTP_RESPONSE_BODY
      );
      span.setAttribute('http.response.body', scrubbed);

      try {
        const serviceAttributes = getAwsServiceData(
          requestRawData.request,
          requestRawData.response,
          span
        );
        if (serviceAttributes) {
          span.setAttributes(serviceAttributes);
        }
      } catch (e) {
        logger.debug('Failed to parse aws service data', e);
        logger.debug('getHttpSpan args', { requestData: requestRawData });
      }
    };
  }

  static extractBodyFromEmitSocketEvent(socketEventArgs) {
    return safeExecute(
      () => {
        if (
          socketEventArgs &&
          socketEventArgs._httpMessage &&
          socketEventArgs._httpMessage._hasBody
        ) {
          const httpMessage = socketEventArgs._httpMessage;
          let lines = [];
          // eslint-disable-next-line no-prototype-builtins
          if (httpMessage.hasOwnProperty('outputData')) {
            lines = httpMessage.outputData[0]?.data.split('\n') || [];
            // eslint-disable-next-line no-prototype-builtins
          } else if (httpMessage.hasOwnProperty('output')) {
            lines = httpMessage.output[0]?.split('\n') || [];
          }
          if (lines.length > 0) {
            return lines[lines.length - 1];
          }
        }
      },
      'failed to extractBodyFromEmitSocketEvent',
      'warn'
    )();
  }

  static getRequestHeaders(request: RequestType) {
    return request.headers || request.getHeaders();
  }

  static extractBodyFromWriteOrEndFunc = (writeEventArgs) => {
    return safeExecute(() => {
      if (isValidHttpRequestBody(writeEventArgs[0])) {
        const encoding = isEncodingType(writeEventArgs[1]) ? writeEventArgs[1] : 'utf8';
        return typeof writeEventArgs[0] === 'string'
          ? Buffer.from(writeEventArgs[0]).toString(encoding)
          : writeEventArgs[0].toString(encoding);
      }
    })();
  };

  static httpRequestArguments(args) {
    if (args.length === 0) {
      throw new Error('http/s.request(...) was called without any arguments.');
    }

    let url = undefined;
    let options = undefined;
    let callback = undefined;

    if (typeof args[0] === 'string' || args[0] instanceof URL) {
      url = args[0];
      if (args[1]) {
        if (typeof args[1] === 'function') {
          callback = args[1];
        } else {
          options = args[1];
          if (typeof args[2] === 'function') {
            callback = args[2];
          }
        }
      }
    } else {
      options = args[0];
      if (typeof args[1] === 'function') {
        callback = args[1];
      }
    }
    return { url, options, callback };
  }

  static getHostFromOptionsOrUrl(options, url) {
    if (url) {
      return new URL(url).hostname;
    }
    return options.hostname || options.host || (options.uri && options.uri.hostname) || 'localhost';
  }

  static httpRequestWriteBeforeHookWrapper(requestData: RequestRawData, span: Span) {
    return function (args) {
      if (isEmptyString(requestData.request.body)) {
        const body = Http.extractBodyFromWriteOrEndFunc(args);
        requestData.request.body += body;
        const scrubbed = scrubHttpPayload(
          requestData.request.body,
          contentType(requestData.request.headers),
          ScrubContext.HTTP_REQUEST_BODY
        );
        if (scrubbed) {
          span.setAttribute('http.request.body', scrubbed);
        }
      }
    };
  }

  static createEmitResponseOnEmitBeforeHookHandler(
    requestRawData: RequestRawData,
    response: any,
    onRequestEnd: (requestRawData: RequestRawData, options: OnRequestEndOptionsType) => void
  ) {
    let body = '';
    const maxPayloadSize = getSpanAttributeMaxLength();
    return function (args) {
      let truncated = false;
      const { headers, statusCode } = response;
      if (args[0] === 'data' && body.length < maxPayloadSize) {
        let chunk = args[1].toString();
        const allowedLengthToAdd = maxPayloadSize - body.length;
        //if we reached or close to limit get only substring of the part to reach the limit
        if (chunk.length > allowedLengthToAdd) {
          truncated = true;
          chunk = chunk.substr(0, allowedLengthToAdd);
        }
        body += chunk;
      }
      if (args[0] === 'end') {
        onRequestEnd(requestRawData, { body, truncated, headers, statusCode });
      }
    };
  }

  static createEmitResponseHandler(
    requestData: RequestRawData,
    span: Span & { attributes: Record<string, string> }
  ) {
    return (response) => {
      const onHandler = Http.createEmitResponseOnEmitBeforeHookHandler(
        requestData,
        response,
        Http.onRequestEnd(span)
      );
      hook(response, 'emit', {
        beforeHook: onHandler,
      });
    };
  }

  static httpRequestEmitBeforeHookWrapper(
    requestData: RequestRawData,
    span: Span & { attributes: Record<string, string> }
  ) {
    const emitResponseHandler = Http.createEmitResponseHandler(requestData, span);
    const oneTimerEmitResponseHandler = runOneTimeWrapper(emitResponseHandler, {});
    return function (args) {
      if (args[0] === 'response') {
        oneTimerEmitResponseHandler(args[1]);
      }
      if (args[0] === 'socket') {
        if (isEmptyString(requestData.request.body)) {
          const body = Http.extractBodyFromEmitSocketEvent(args[1]);
          requestData.request.body += body;
          const scrubbed = scrubHttpPayload(
            requestData.request.body,
            contentType(requestData.request.headers),
            ScrubContext.HTTP_REQUEST_BODY
          );
          if (scrubbed) {
            span.setAttribute('http.request.body', scrubbed);
          }
        }
      }
    };
  }
}
