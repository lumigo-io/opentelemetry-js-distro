import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { Instrumentor } from '../instrumentor';
import { preRequestHook, responseHook, sqsProcessHook } from './hooks';

export abstract class LumigoAwsSdkLibInstrumentation extends Instrumentor<AwsInstrumentation> {
  getInstrumentation(): AwsInstrumentation {
    return new AwsInstrumentation({
      responseHook,
      preRequestHook,
      sqsProcessHook,
    });
  }
}
