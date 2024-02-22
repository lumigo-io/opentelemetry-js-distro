import { Instrumentor } from "../instrumentor";
import { AwsInstrumentation } from "./AwsSdkInstrumentation";

export class LumigoAwsSdkLibInstrumentation extends Instrumentor<AwsInstrumentation> {
  getInstrumentedModule(): string {
    return 'aws-sdk';
  }

  getInstrumentation(): AwsInstrumentation {
    return new AwsInstrumentation();
  }
}