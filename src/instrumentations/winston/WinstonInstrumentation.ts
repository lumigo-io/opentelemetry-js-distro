import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { Instrumentor } from '../instrumentor';

export default class LumigoWinstonInstrumentation extends Instrumentor<WinstonInstrumentation> {
  getInstrumentedModule(): string {
    return 'winston';
  }

  getInstrumentation(): WinstonInstrumentation {
    return new WinstonInstrumentation();
  }

  override isApplicable(): boolean {
    return super.isApplicable() && process.env.LUMIGO_ENABLE_LOGS?.toLowerCase() === 'true';
  }
}
