import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { TracingInstrumentor } from '../../instrumentor';

export default class LumigoNestInstrumentation extends TracingInstrumentor<NestInstrumentation> {
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
