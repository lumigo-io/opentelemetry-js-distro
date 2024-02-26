import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { Instrumentor } from '../instrumentor';
import { AwsParsedService, SupportedAwsServices } from '../../spans/types';
import { responseHook } from './hooks';

export const AWS_INSTRUMENTATION_SUPPORTED_SERVICE_TYPES: SupportedAwsServices[] = [
  AwsParsedService.SQS,
];

export class LumigoAwsSdkLibInstrumentation extends Instrumentor<AwsInstrumentation> {
  getInstrumentedModule(): string {
    return 'aws-sdk';
  }

  getInstrumentation(): AwsInstrumentation {
    return new AwsInstrumentation({ responseHook });
  }
}
