import { PrismaInstrumentation } from '@prisma/instrumentation';
import { TracingInstrumentor } from '../instrumentor';

export default class LumigoPrismaInstrumentation extends TracingInstrumentor<PrismaInstrumentation> {
  getInstrumentedModule(): string {
    return '@prisma/client';
  }

  getInstrumentation(): PrismaInstrumentation {
    return new PrismaInstrumentation();
  }
}
