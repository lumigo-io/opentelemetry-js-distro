// eslint-disable-next-line import/no-unresolved
import { FetchInstrumentation } from '@vercel/otel';
import { TracingInstrumentor } from '../instrumentor';

export default class LumigoNestInstrumentation extends TracingInstrumentor<FetchInstrumentation> {
  getInstrumentedModule(): string {
    return 'next';
  }

  getInstrumentation(): FetchInstrumentation {
    return new FetchInstrumentation();
  }
}
