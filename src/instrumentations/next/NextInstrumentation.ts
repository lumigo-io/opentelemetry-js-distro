// eslint-disable-next-line import/no-unresolved
import { FetchInstrumentation } from '@vercel/otel';
import { TracingInstrumentor } from '../instrumentor';

export default class LumigoNestInstrumentation extends TracingInstrumentor<FetchInstrumentation> {
  override isApplicable(): boolean {
    return (
      super.isApplicable() &&
      process.env.LUMIGO_DISABLE_NEST_INSTRUMENTATION?.toLocaleLowerCase() !== 'true'
    );
  }

  getInstrumentedModule(): string {
    return 'next';
  }

  getInstrumentation(): FetchInstrumentation {
    return new FetchInstrumentation();
  }
}
