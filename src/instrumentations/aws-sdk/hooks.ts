import { shouldAutoFilterEmptySqs } from '../../parsers/aws';
import { AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES } from './LumigoAwsSdkLibInstrumentation';
import type {
  AwsSdkRequestHookInformation,
  AwsSdkResponseHookInformation,
} from '@opentelemetry/instrumentation-aws-sdk';
import type { Span as MutableSpan } from '@opentelemetry/sdk-trace-base';
import { setSpanAsNotExportable } from '../../resources/spanProcessor';
import { AwsParsedService } from '../../spans/types';
import { extractAttributesFromSqsResponse } from './attribute-extractors';
import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import { getSpanAttributeMaxLength } from '../../utils';

const SQS_PUBLISH_OPERATIONS = ['SendMessage', 'SendMessageBatch'];
const SQS_CONSUME_OPERATIONS = ['ReceiveMessage'];

export const preRequestHook = (span: MutableSpan, requestInfo: AwsSdkRequestHookInformation) => {
  const awsServiceIdentifier = (span.attributes?.['rpc.service'] as string)?.toLowerCase();

  // SKip all spans that are currently covered by the http-instrumentation
  if (
    !AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES.includes(awsServiceIdentifier as AwsParsedService)
  ) {
    setSpanAsNotExportable(span as MutableSpan);
    return;
  }

  const sqsOperation = span.attributes?.['rpc.method'] as string;

  if (SQS_PUBLISH_OPERATIONS.includes(sqsOperation)) {
    span.setAttribute(
      'messaging.publish.body',
      CommonUtils.payloadStringify(
        requestInfo.request.commandInput,
        ScrubContext.HTTP_REQUEST_BODY,
        getSpanAttributeMaxLength()
      )
    );
  }
};

export const responseHook = (span: MutableSpan, responseInfo: AwsSdkResponseHookInformation) => {
  const awsServiceIdentifier = (span.attributes?.['rpc.service'] as string)?.toLowerCase();

  // SKip all spans that are currently covered by the http-instrumentation
  if (
    !AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES.includes(awsServiceIdentifier as AwsParsedService)
  ) {
    setSpanAsNotExportable(span as MutableSpan);
    return;
  }

  if (awsServiceIdentifier === AwsParsedService.SQS) {
    const sqsOperation = span.attributes?.['rpc.method'] as string;

    if (shouldAutoFilterEmptySqs() && sqsOperation === "ReceiveMessage" && responseInfo.response.data.Messages?.length === 0) {
      setSpanAsNotExportable(span as MutableSpan);
    } else {
      span.setAttributes(extractAttributesFromSqsResponse(responseInfo.response.data, span));

      const sqsOperation = span.attributes['rpc.method'] as string;

      if (SQS_CONSUME_OPERATIONS.includes(sqsOperation)) {
        span.setAttribute(
          'messaging.consume.body',
          CommonUtils.payloadStringify(
            responseInfo.response.data,
            ScrubContext.HTTP_RESPONSE_BODY,
            getSpanAttributeMaxLength()
          )
        );
      }
    }
  }
};
