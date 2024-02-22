import { InstrumentationBase, InstrumentationModuleDefinition } from "@opentelemetry/instrumentation";

export class AwsInstrumentation extends InstrumentationBase<any> {
  protected override init(): void | InstrumentationModuleDefinition<any> | InstrumentationModuleDefinition<any>[] {
    throw new Error("Method not implemented.");
  }

  static readonly component = 'aws-sdk';

  constructor() {
    super(
      'lumigo-aws-sdk-instrumentation',
      "0.0.0"
    );
  }
}
