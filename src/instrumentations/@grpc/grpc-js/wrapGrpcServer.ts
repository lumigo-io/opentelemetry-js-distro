import shimmer from 'shimmer';
import * as grpcServerUtils from '@opentelemetry/instrumentation-grpc/build/src/grpc-js/serverUtils';
import type { Span } from '@opentelemetry/api';
import type {
  HandleCall,
  SendUnaryDataCallback,
  ServerCallWithMeta,
} from '@opentelemetry/instrumentation-grpc/build/src/grpc-js/types';
import { safeExecute } from '@lumigo/node-core/lib/utils';
import { concatenatePayload } from './utils';

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
      let serverStreamAggData = '';
      // @ts-ignore
      call.on('data', (res) => {
        serverStreamAggData = concatenatePayload(serverStreamAggData, res);
      });
      // @ts-ignore
      call.on('finish', () => {
        safeExecute(() => {
          span.setAttribute(
            'rpc.request.payload',
            // @ts-ignore - `request` is not always a member of `ServerCallWithMeta`
            serverStreamAggData || JSON.stringify(call?.request)
          );
        })();
      });
    };

    const clientStreamAndUnaryHandlerPrefix = (): void => {
      // @ts-ignore
      call.on('data', (res) => {
        clientStreamAggData = concatenatePayload(clientStreamAggData, res);
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
