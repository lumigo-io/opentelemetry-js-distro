import shimmer from 'shimmer';
import * as grpcServerUtils from '@opentelemetry/instrumentation-grpc/build/src/grpc-js/serverUtils';
import { Span } from '@opentelemetry/api';
import {
  HandleCall,
  SendUnaryDataCallback,
  ServerCallWithMeta,
} from '@opentelemetry/instrumentation-grpc/build/src/grpc-js/types';
import { safeExecute } from '@lumigo/node-core/lib/utils';

const newHandleServerFunction = (originalPatcher) => {
  return function <RequestType, ResponseType>(
    span: Span,
    type: string,
    originalFunc: HandleCall<RequestType, ResponseType>,
    call: ServerCallWithMeta<RequestType, ResponseType>,
    callback: SendUnaryDataCallback<unknown>
  ) {
    let clientStreamAggData = '';

    const serverStreamAndBidiHandlerPrefix = (): void => {
      let aggData = '';
      call.on('data', (res) => {
        safeExecute(() => {
          aggData += JSON.stringify(res);
        })();
      });
      call.on('finish', () => {
        safeExecute(() => {
          // @ts-ignore
          span.setAttribute('rpc.request.payload', aggData || JSON.stringify(call?.request));
        })();
      });
    };

    const clientStreamAndUnaryHandlerPrefix = (): void => {
      call.on('data', (res) => {
        safeExecute(() => {
          clientStreamAggData += JSON.stringify(res);
        })();
      });
    };

    const patchedCallbackPrefix = safeExecute((err, value): void => {
      span.setAttribute('rpc.response.payload', JSON.stringify(value));
      span.setAttribute(
        'rpc.request.payload',
        // @ts-ignore
        call?.request ? JSON.stringify(call.request) : clientStreamAggData
      );
    });

    switch (type) {
      case 'unary':
      case 'clientStream':
      case 'client_stream':
        clientStreamAndUnaryHandlerPrefix();
        break;
      case 'serverStream':
      case 'server_stream':
      case 'bidi':
        serverStreamAndBidiHandlerPrefix();
        break;
      default:
        break;
    }

    // originalPatcher will wrap the callback and will close the span before we will get to commit the attributes
    // So we should wrap the callback only after originalPatcher.
    // We do it by hooking originalFunc, and patch the callback just before it is being executed.
    const newOriginalFunc = (call, patchedCallback) => {
      const ourPatchedCallback = (err, value) => {
        patchedCallbackPrefix(err, value);
        return patchedCallback(err, value);
      };
      return originalFunc.call({}, call, ourPatchedCallback);
    };

    return originalPatcher.call(this, span, type, newOriginalFunc, call, callback);
  };
};

export const wrapServer = () => {
  shimmer.wrap(grpcServerUtils, 'handleServerFunction', newHandleServerFunction);
};
