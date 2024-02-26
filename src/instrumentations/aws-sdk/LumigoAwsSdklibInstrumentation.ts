import {AwsInstrumentation} from "@opentelemetry/instrumentation-aws-sdk";
import { Instrumentor } from "../instrumentor";
import {attributesFromAwsSdkContext} from "../../parsers/aws";

const SERVICES_REMOVED_FROM_LUMIGO_HTTP_INSTRUMENTATION = ['sqs'];

export class LumigoAwsSdkLibInstrumentation extends Instrumentor<AwsInstrumentation> {
  getInstrumentedModule(): string {
    return 'aws-sdk';
  }

  getInstrumentation(): AwsInstrumentation {
    return new AwsInstrumentation({
      responseHook: (span, responseInfo) => {
        const spanAttributes = span['attributes'] || {};
        const awsServiceIdentifier = spanAttributes["aws.service.identifier"]

        if (SERVICES_REMOVED_FROM_LUMIGO_HTTP_INSTRUMENTATION.includes(awsServiceIdentifier)) {
          span.setAttributes(attributesFromAwsSdkContext(span, responseInfo.response.data.Messages))
        } else {
          // TODO: skip span
        }
      }
    });
  }
}