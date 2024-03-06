import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { Instrumentor } from '../../instrumentor';

export default class LumigoNestInstrumentation extends Instrumentor<NestInstrumentation> {
  getInstrumentedModule(): string {
    return '@nestjs/core';
  }

  getInstrumentation(): NestInstrumentation {
    return new NestInstrumentation();
  }
}
