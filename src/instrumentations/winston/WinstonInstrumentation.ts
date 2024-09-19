import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { LoggingInstrumentor } from '../instrumentor';

export default class LumigoWinstonInstrumentation extends LoggingInstrumentor<WinstonInstrumentation> {
  getInstrumentedModule(): string {
    return 'winston';
  }

  getInstrumentation(): WinstonInstrumentation {
    return new WinstonInstrumentation();
  }
}
