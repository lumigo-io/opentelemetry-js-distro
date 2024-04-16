import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { Instrumentor } from '../instrumentor';
import { canRequireModule } from '../../utils';

export default class LumigoWinstonInstrumentation extends Instrumentor<WinstonInstrumentation> {
  getInstrumentedModule(): string {
    return 'winston';
  }

  getInstrumentation(): WinstonInstrumentation {
    return new WinstonInstrumentation();
  }

  override isApplicable(): boolean {
    return (
      super.isApplicable() &&
      canRequireModule('@opentelemetry/winston-transport') &&
      process.env.LUMIGO_LOGS_ENABLED?.toLowerCase() === 'true'
    );
  }
}
