import shimmer from 'shimmer';
import * as grpcClientUtils from '@opentelemetry/instrumentation-grpc/build/src/grpc-js/clientUtils';
import { metadataCaptureType } from '@opentelemetry/instrumentation-grpc/build/src/internal-types';
import {
  GrpcClientFunc,
  GrpcEmitter,
} from '@opentelemetry/instrumentation-grpc/build/src/grpc-js/types';
import type { Client, Metadata } from '@grpc/grpc-js';
import { Span } from '@opentelemetry/api';
import { safeExecute } from '@lumigo/node-core/lib/utils';

const wrapCallback = (span: Span, original: GrpcClientFunc, args): void => {
  if (!original.responseStream) {
    const callbackFuncIndex = args.findIndex((arg) => {
      return typeof arg === 'function';
    });
    if (callbackFuncIndex !== -1) {
      const originalCallback = args[callbackFuncIndex];
      args[callbackFuncIndex] = (err, res) => {
        safeExecute(() => {
          span.setAttribute('rpc.request.payload', JSON.stringify(args[0]));
          span.setAttribute('rpc.response.payload', JSON.stringify(res));
        })();
        return originalCallback(err, res);
      };
    }
  }
};

const wrapResponseStream = (
  span: Span,
  original: GrpcClientFunc,
  args: unknown[],
  call: GrpcEmitter
) => {
  if (original.responseStream) {
    span.setAttribute('rpc.request.payload', JSON.stringify(args[0]));
    let aggData = '';
    call.on('data', (res) =>
      safeExecute(() => {
        aggData += JSON.stringify(res);
        span.setAttribute('rpc.response.payload', aggData);
      })()
    );
  }
};

const wrapOriginal = (span: Span, original: GrpcClientFunc) => {
  const res = function (...args) {
    safeExecute(() => wrapCallback(span, original, args))();
    const call = original.apply(this, args);
    safeExecute(() => wrapResponseStream(span, original, args, call))();
    return call;
  };
  res.path = original.path;
  res.requestStream = original.requestStream;
  res.responseStream = original.responseStream;
  return res;
};

export const wrapClient = () => {
  shimmer.wrap(grpcClientUtils, 'makeGrpcClientRemoteCall', (originalMakeGrpcClientRemoteCall) => {
    return function (
      metadataCapture: metadataCaptureType,
      original: GrpcClientFunc,
      args: unknown[],
      metadata: Metadata,
      self: Client
    ) {
      return (span: Span) =>
        originalMakeGrpcClientRemoteCall(
          metadataCapture,
          safeExecute(
            () => wrapOriginal(span, original),
            'failed to wrapOriginal',
            'WARNING',
            original
          )(),
          args,
          metadata,
          self
        )(span);
    };
  });
};
