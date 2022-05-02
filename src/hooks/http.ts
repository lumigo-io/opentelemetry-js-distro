import * as shimmer from 'shimmer';
import { diag, Span } from '@opentelemetry/api';
import { ClientRequest, IncomingMessage, ServerResponse } from 'http';
import { InstrumentationIfc } from './hooksIfc';
import { isAwsService, runOneTimeWrapper, safeExecute } from '../utils';
import { getAwsServiceData } from '../spans/awsSpan';
import { RequestRawData } from '@lumigo/node-core/lib/types/spans/httpSpan';
import { CommonUtils } from '@lumigo/node-core';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

const isFunctionAlreadyWrapped = (fn) => fn && fn.__wrapped;

export type HookOptions = {
  beforeHook?: Function,
  afterHook?: Function,
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
    console.warn(`Wrapping of function ${funcName} failed`, options);
  }
};

const MAX_SIZE = 4084;

type OnRequestEndOptionsType = {
  body: string,
  headers: Record<string, string>,
  statusCode: number,
  truncated: boolean,
};

const onRequestEnd = (span: Span & { attributes: Record<string, string> }) => {
  return (requestRawData: RequestRawData, options: OnRequestEndOptionsType) => {
    const { body, headers, statusCode, truncated } = options;
    requestRawData.response.body = body;
    requestRawData.response.headers = headers;
    requestRawData.response.statusCode = statusCode;
    requestRawData.response.truncated = truncated;
    const scrubed = CommonUtils.scrubRequestDataPayload(requestRawData.response);
    span.setAttribute(
      'http.response.body',
      scrubed
    );
    try {
      if (isAwsService(requestRawData.request.host, requestRawData.response)) {
        span.setAttributes(
          getAwsServiceData(requestRawData.request, requestRawData.response, span)
        );
        span.setAttribute('aws.region', span.attributes?.['http.host'].split('.')[1]);
      }
    } catch (e) {
      console.warn('Failed to parse aws service data', e);
      console.warn('getHttpSpan args', { requestData: requestRawData });
    }
  };
};

const createEmitResponseOnEmitBeforeHookHandler = (
  requestRawData: RequestRawData,
  response: any,
  onRequestEnd: (requestRawData: RequestRawData, options: OnRequestEndOptionsType) => void
) => {
  let body = '';
  const maxPayloadSize = MAX_SIZE;
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
};

export const isValidHttpRequestBody = (reqBody) =>
  !!(reqBody && (typeof reqBody === 'string' || reqBody instanceof Buffer));

export const isEncodingType = (encodingType): boolean =>
  !!(
    encodingType &&
    typeof encodingType === 'string' &&
    ['ascii', 'utf8', 'utf16le', 'ucs2', 'base64', 'binary', 'hex'].includes(encodingType)
  );

export const extractBodyFromEmitSocketEvent = (socketEventArgs) => {
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
    'warn',
    ''
  )();
};

export const isEmptyString = (str): boolean =>
  !!(!str || (typeof str === 'string' && str.length === 0));

export const extractBodyFromWriteOrEndFunc = (writeEventArgs) => {
  return safeExecute(() => {
    if (isValidHttpRequestBody(writeEventArgs[0])) {
      const encoding = isEncodingType(writeEventArgs[1]) ? writeEventArgs[1] : 'utf8';
      return typeof writeEventArgs[0] === 'string'
        ? new Buffer(writeEventArgs[0]).toString(encoding)
        : writeEventArgs[0].toString();
    }
  })();
};

const createEmitResponseHandler = (
  requestData: RequestRawData,
  span: Span & { attributes: Record<string, string> }
) => {
  return (response) => {
    const onHandler = createEmitResponseOnEmitBeforeHookHandler(
      requestData,
      response,
      onRequestEnd(span)
    );
    hook(response, 'emit', {
      beforeHook: onHandler,
    });
  };
};

const httpRequestWriteBeforeHookWrapper = (requestData: RequestRawData, span: Span) => {
  return function (args) {

    if (isEmptyString(requestData.request.body)) {
      const body = extractBodyFromWriteOrEndFunc(args);
      requestData.request.body += body;
      const scrubed = CommonUtils.scrubRequestDataPayload(requestData.request);
      span.setAttribute(
        'http.request.body',
        scrubed
      );
    }
  };
};

const httpRequestEmitBeforeHookWrapper = (
  requestData: RequestRawData,
  span: Span & { attributes: Record<string, string> }
) => {
  const emitResponseHandler = createEmitResponseHandler(requestData, span);
  const oneTimerEmitResponseHandler = runOneTimeWrapper(emitResponseHandler, {});
  return function (args) {
    if (args[0] === 'response') {
      oneTimerEmitResponseHandler(args[1]);
    }
    if (args[0] === 'socket') {
      if (isEmptyString(requestData.request.body)) {
        const body = extractBodyFromEmitSocketEvent(args[1]);
        requestData.request.body += body;
        const scrubed = CommonUtils.scrubRequestDataPayload(requestData.request);
        span.setAttribute(
          'http.request.body',
          scrubed
        );
      }
    }
  };
};

type RequestType = (ClientRequest | IncomingMessage) & { headers?: any, getHeaders: () => any };

function getRequestHeaders(request: RequestType) {
  return request.headers || request.getHeaders();
}

export const HttpHooks: InstrumentationIfc<
  ClientRequest | IncomingMessage,
  IncomingMessage | ServerResponse
> = {
  requestHook(span: Span & { attributes: Record<string, string> }, request: RequestType) {
    diag.debug('@opentelemetry/instrumentation-http on requestHook()');
    safeExecute(() => {
      const requestData: RequestRawData = {
        request: {
          path: span.attributes?.['http.target'],
          host: span.attributes?.['http.host'],
          truncated: false,
          body: '',
          headers: getRequestHeaders(request),
        },
        response: {
          truncated: false,
          body: '',
          headers: {},
        },
      };
      const scrubedHeaders = CommonUtils.payloadStringify(requestData.request.headers);
      span.setAttribute('http.request.headers', scrubedHeaders);
      const emitWrapper = httpRequestEmitBeforeHookWrapper(requestData, span);

      const writeWrapper = httpRequestWriteBeforeHookWrapper(requestData, span);

      const endWrapper = (requestData: RequestRawData, span: Span) => {
        return function (args) {
          if (isEmptyString(requestData.request.body)) {
            const body = extractBodyFromWriteOrEndFunc(args);
            requestData.request.body += body;
            const scrubed = CommonUtils.scrubRequestDataPayload(requestData.request);
            span.setAttribute(
              'http.request.body',
              scrubed
            );
          }
        };
      };

      hook(request, 'end', { beforeHook: endWrapper });
      hook(request, 'emit', { beforeHook: emitWrapper });
      hook(request, 'write', { beforeHook: writeWrapper });
    })();
  },
  responseHook(span: Span, response: IncomingMessage | (ServerResponse & { headers?: any })) {
    diag.debug('@opentelemetry/instrumentation-http on responseHook()');
    const scrubedHeaders = CommonUtils.payloadStringify(response.headers);
    if (response.headers) {
      span.setAttribute('http.response.headers', scrubedHeaders);
    }
  },
};
