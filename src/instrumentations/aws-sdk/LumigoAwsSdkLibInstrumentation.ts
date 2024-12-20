import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { TracingInstrumentor } from '../instrumentor';
import { preRequestHook, responseHook, sqsProcessHook } from './hooks';

export abstract class LumigoAwsSdkLibInstrumentation extends TracingInstrumentor<AwsInstrumentation> {
  override isApplicable(): boolean {
    return (
      super.isApplicable() &&
      process.env.LUMIGO_USE_AWS_SDK_INSTRUMENTATION?.toLocaleLowerCase() === 'true'
    );
  }

  getInstrumentation(): AwsInstrumentation {
    return new AwsInstrumentation({
      responseHook,
      preRequestHook,
      sqsProcessHook,
    });
  }
}
