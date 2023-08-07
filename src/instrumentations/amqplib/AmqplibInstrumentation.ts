import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { Instrumentor } from '../instrumentor';

export default class LumigoAmqplibInstrumentation extends Instrumentor<AmqplibInstrumentation> {
  getInstrumentedModule(): string {
    return 'amqplib';
  }

  getInstrumentation(): AmqplibInstrumentation {
    return new AmqplibInstrumentation({
      // publishHook: (span: Span, publishInfo: PublishInfo) => { },
      // publishConfirmHook: (span: Span, publishConfirmedInto: PublishConfirmedInfo) => { },
      // consumeHook: (span: Span, consumeInfo: ConsumeInfo) => { },
      // consumeEndHook: (span: Span, consumeEndInfo: ConsumeEndInfo) => { },
    });
  }
}
