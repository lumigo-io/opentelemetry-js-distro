import { Instrumentor } from '../instrumentor';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';

export default class LumigoAwsSdkInstrumentation extends Instrumentor<AwsInstrumentation> {
  getInstrumentedModule(): string {
    // TODO: can also be @aws-sdk/... with v3 - we need to account for all cases
    return 'aws-sdk';
  }

  getInstrumentation(): AwsInstrumentation {
    return new AwsInstrumentation({
      suppressInternalInstrumentation: true, // Suppress internal http-spans emitted by the instrumentation
    });
  }
}
