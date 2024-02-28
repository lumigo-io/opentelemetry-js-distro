import { shouldAutoFilterEmptySqs } from '../../parsers/aws';
import { AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES } from './LumigoAwsSdkLibInstrumentation';
import type { AwsSdkResponseHookInformation } from '@opentelemetry/instrumentation-aws-sdk';
import type { Span as MutableSpan } from '@opentelemetry/sdk-trace-base';
import { setSpanAsNotExportable } from '../../resources/spanProcessor';
import { AwsParsedService } from '../../spans/types';
import { extractSqsAttributes } from './attribute-extractors';

export const responseHook = (span: MutableSpan, responseInfo: AwsSdkResponseHookInformation) => {
  const awsServiceIdentifier = span.attributes['aws.service.identifier'];

  // SKip all spans that are currently covered by the http-instrumentation
  if (
    !AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES.includes(awsServiceIdentifier as AwsParsedService)
  ) {
    setSpanAsNotExportable(span as MutableSpan);
    return;
  }

  if (awsServiceIdentifier === AwsParsedService.SQS) {
    if (shouldAutoFilterEmptySqs() && responseInfo.response.data.Messages?.length === 0) {
      setSpanAsNotExportable(span as MutableSpan);
    } else {
      span.setAttributes(extractSqsAttributes(responseInfo.response.data, span));
      span.setAttribute("messaging.consume.body", JSON.stringify(responseInfo.response.data));
    }
  }
};
