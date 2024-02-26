import { attributesFromAwsSdkContext, shouldAutoFilterEmptySqs } from "../../parsers/aws";
import { AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES } from "./LumigoAwsSdklibInstrumentation";
import type { AwsSdkResponseHookInformation } from "@opentelemetry/instrumentation-aws-sdk";
import type { Span } from '@opentelemetry/api';
import type { Span as MutableSpan } from '@opentelemetry/sdk-trace-base';
import {setSpanAsNotExportable} from "../../resources/spanProcessor";
import {AwsParsedService} from "../../spans/types";

export const responseHook = (span: Span, responseInfo: AwsSdkResponseHookInformation) => {
  const spanAttributes = span['attributes'] || {};
  const awsServiceIdentifier = spanAttributes['aws.service.identifier'];

  if (!AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES.includes(awsServiceIdentifier)) {
    // SKip all spans that are currently covered by the http-instrumentation
    setSpanAsNotExportable(span as MutableSpan);
    return
  }

  if (awsServiceIdentifier === AwsParsedService.SQS) {
    if (shouldAutoFilterEmptySqs() && responseInfo.response.data.Messages?.length === 0) {
      setSpanAsNotExportable(span as MutableSpan);
    } else {
      span.setAttributes(
        attributesFromAwsSdkContext(span, responseInfo.response.data.Messages)
      );
    }
  }
}