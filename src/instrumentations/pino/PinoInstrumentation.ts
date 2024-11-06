import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { LoggingInstrumentor } from '../instrumentor';

export default class LumigoPinoInstrumentation extends LoggingInstrumentor<PinoInstrumentation> {
  getInstrumentedModule(): string {
    return 'pino';
  }

  getInstrumentation(): PinoInstrumentation {
    return new PinoInstrumentation();
  }
}
