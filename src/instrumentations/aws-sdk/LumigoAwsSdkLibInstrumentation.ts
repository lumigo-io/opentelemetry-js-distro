import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { Instrumentor } from '../instrumentor';
import { AwsParsedService, SupportedAwsServices } from '../../spans/types';
import { preRequestHook, responseHook } from './hooks';

export const AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES: SupportedAwsServices[] = [
  AwsParsedService.SQS,
  AwsOtherService.ElasticBeanstalkSqsDaemon
];

export class LumigoAwsSdkLibInstrumentation extends Instrumentor<AwsInstrumentation> {
  getInstrumentedModules(): string[] {
    return ['aws-sdk', '@aws-sdk/client-sqs'];
  }

  getInstrumentation(): AwsInstrumentation {
    return new AwsInstrumentation({ responseHook, preRequestHook });
  }
}
