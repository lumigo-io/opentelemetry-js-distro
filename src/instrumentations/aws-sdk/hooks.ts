import { shouldAutoFilterEmptySqs } from '../../parsers/aws';
import {
  isServiceSupportedByLumigoAwsSdkInstrumentation,
  setAwsInstrumentationSpanActive,
} from './shared';
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
import { SpanKind } from '@opentelemetry/api';
import {
  SEMATTRS_MESSAGING_MESSAGE_ID,
  SEMATTRS_MESSAGING_OPERATION,
  SEMATTRS_RPC_METHOD,
  SEMATTRS_RPC_SERVICE,
} from '@opentelemetry/semantic-conventions';

const SQS_PUBLISH_OPERATIONS = ['SendMessage', 'SendMessageBatch'];
const SQS_CONSUME_OPERATIONS = ['ReceiveMessage'];

export const preRequestHook = (span: MutableSpan, requestInfo: AwsSdkRequestHookInformation) => {
  const awsServiceIdentifier = (span.attributes?.[SEMATTRS_RPC_SERVICE] as string)?.toLowerCase();

  // Skip all spans that are currently covered by the http-instrumentation
  if (!isServiceSupportedByLumigoAwsSdkInstrumentation(awsServiceIdentifier as AwsParsedService)) {
    setSpanAsNotExportable(span as MutableSpan);
    return;
  } else {
    // Signal other instrumentations that an aws-sdk span is active
    setAwsInstrumentationSpanActive(true);
  }

  const sqsOperation = span.attributes?.[SEMATTRS_RPC_METHOD] as string;

  if (SQS_PUBLISH_OPERATIONS.includes(sqsOperation)) {
    span.setAttribute('aws.queue.name', span.attributes['messaging.destination.name']);
    span.setAttribute(SEMATTRS_MESSAGING_OPERATION, sqsOperation);
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
  const awsServiceIdentifier = (span.attributes?.[SEMATTRS_RPC_SERVICE] as string)?.toLowerCase();

  // Skip all spans that are currently not supported by the aws-sdk instrumentation,
  // assuming those will be covered by the http-instrumentation for the meantime
  if (!isServiceSupportedByLumigoAwsSdkInstrumentation(awsServiceIdentifier as AwsParsedService)) {
    setSpanAsNotExportable(span as MutableSpan);
    return;
  }

  if (awsServiceIdentifier === AwsParsedService.SQS) {
    const sqsOperation = span.attributes?.[SEMATTRS_RPC_METHOD] as string;

    if (
      shouldAutoFilterEmptySqs() &&
      sqsOperation === 'ReceiveMessage' &&
      !responseInfo.response.data.Messages?.length
    ) {
      setSpanAsNotExportable(span as MutableSpan);
    } else {
      span.setAttributes(extractAttributesFromSqsResponse(responseInfo.response.data, span));

      if (SQS_CONSUME_OPERATIONS.includes(sqsOperation)) {
        span.setAttribute('aws.queue.name', span.attributes['messaging.destination.name']);
        span.setAttribute(SEMATTRS_MESSAGING_OPERATION, sqsOperation);
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

  // Signal other instrumentations that an aws-sdk span is becoming inactive
  setAwsInstrumentationSpanActive(false);
};

export const sqsProcessHook = (span: MutableSpan) => {
  // @ts-expect-error - span kind is read-only
  span.kind = SpanKind.INTERNAL;

  delete span['attributes'][SEMATTRS_MESSAGING_MESSAGE_ID];
};
