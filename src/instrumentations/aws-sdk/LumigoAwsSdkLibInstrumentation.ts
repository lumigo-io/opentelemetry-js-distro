import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { Instrumentor } from '../instrumentor';
import { AwsOtherService, AwsParsedService, SupportedAwsServices } from '../../spans/types';
import { preRequestHook, responseHook, sqsProcessHook } from './hooks';

const LUMIGO_AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES: SupportedAwsServices[] = [
  AwsParsedService.SQS,
  AwsOtherService.ElasticBeanstalkSqsDaemon,
];

export const isServiceSupportedByLumigoAwsSdkInstrumentation = (
  serviceType: SupportedAwsServices
): boolean => LUMIGO_AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES.includes(serviceType);

export class LumigoAwsSdkLibInstrumentation extends Instrumentor<AwsInstrumentation> {
  getInstrumentedModule(): string {
    // Add '@aws-sdk/client-sqs' once https://github.com/open-telemetry/opentelemetry-js-contrib/issues/1987 is resolved
    return 'aws-sdk';
  }

  getInstrumentation(): AwsInstrumentation {
    return new AwsInstrumentation({
      responseHook,
      preRequestHook,
      sqsProcessHook,
    });
  }
}
