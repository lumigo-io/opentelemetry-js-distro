import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { Instrumentor } from '../../instrumentor';

export default class LumigoNestInstrumentation extends Instrumentor<NestInstrumentation> {
  override isApplicable(): boolean {
    return (
      super.isApplicable() &&
      process.env.LUMIGO_DISABLE_NEST_INSTRUMENTATION?.toLocaleLowerCase() !== 'true'
    );
  }

  getInstrumentedModule(): string {
    return '@nestjs/core';
  }

  getInstrumentation(): NestInstrumentation {
    return new NestInstrumentation();
  }
}
