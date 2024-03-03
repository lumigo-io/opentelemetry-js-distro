import { PrismaInstrumentation } from '@prisma/instrumentation';
import { Instrumentor } from '../instrumentor';

export default class LumigoPrismaInstrumentation extends Instrumentor<PrismaInstrumentation> {
  getInstrumentedModules(): string[] {
    return ['prisma'];
  }

  getInstrumentation(): PrismaInstrumentation {
    return new PrismaInstrumentation({
      middleware: true,
    });
  }
}
