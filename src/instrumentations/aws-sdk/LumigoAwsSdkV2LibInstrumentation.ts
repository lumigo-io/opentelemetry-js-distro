import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { Instrumentor } from '../instrumentor';
import { preRequestHook, responseHook, sqsProcessHook } from './hooks';

export class LumigoAwsSdkV2LibInstrumentation extends Instrumentor<AwsInstrumentation> {
  getInstrumentedModule(): string {
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
