import { Instrumentor } from '../instrumentor';
import { AwsInstrumentation } from '@opentelemetry/instrumentation-aws-sdk';
import { SQS_RECEIVE_SPAN_KEY } from '../../constants';

export default class LumigoAwsSdkInstrumentation extends Instrumentor<AwsInstrumentation> {
  getInstrumentedModule(): string {
    // TODO: can also be @aws-sdk/... with v3 - we need to account for all cases
    return 'aws-sdk';
  }

  getInstrumentation(): AwsInstrumentation {
    return new AwsInstrumentation({
      suppressInternalInstrumentation: true, // Suppress internal http-spans emitted by the instrumentation
      responseHook: (span, { response }) => {
        if (response.data.Messages!) {
          response.data[SQS_RECEIVE_SPAN_KEY] = span;
        }
      },
    });
  }
}
