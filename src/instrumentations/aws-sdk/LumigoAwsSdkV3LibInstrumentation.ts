import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { Instrumentor } from '../instrumentor';
import { preRequestHook, responseHook, sqsProcessHook } from './hooks';

export class LumigoAwsSdkV3LibInstrumentation extends Instrumentor<AwsInstrumentation> {
  getInstrumentedModule(): string {
    return '@aws-sdk/client-sqs';
  }

  getInstrumentation(): AwsInstrumentation {
    return new AwsInstrumentation({
      responseHook,
      preRequestHook,
      sqsProcessHook,
    });
  }
}
