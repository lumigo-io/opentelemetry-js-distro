import { LumigoAwsSdkLibInstrumentation } from './LumigoAwsSdkLibInstrumentation';

export class LumigoAwsSdkV3LibInstrumentation extends LumigoAwsSdkLibInstrumentation {
  getInstrumentedModule(): string {
    return '@aws-sdk/client-sqs';
  }
}
