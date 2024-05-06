import { LumigoAwsSdkLibInstrumentation } from './LumigoAwsSdkLibInstrumentation';

export class LumigoAwsSdkV2LibInstrumentation extends LumigoAwsSdkLibInstrumentation {
  getInstrumentedModule(): string {
    return 'aws-sdk';
  }
}
