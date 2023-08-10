import { Span } from '@opentelemetry/api';
import {
  AmqplibInstrumentation,
  ConsumeInfo,
  PublishInfo,
} from '@opentelemetry/instrumentation-amqplib';
import { Instrumentor } from '../instrumentor';

export default class LumigoAmqplibInstrumentation extends Instrumentor<AmqplibInstrumentation> {
  getInstrumentedModule(): string {
    return 'amqplib';
  }

  getInstrumentation(): AmqplibInstrumentation {
    return new AmqplibInstrumentation({
      publishHook: (span: Span, publishInfo: PublishInfo) => {
        span.setAttribute('messaging.publish.body', publishInfo.content.toString());
      },
      consumeHook: (span: Span, consumeInfo: ConsumeInfo) => {
        span.setAttribute('messaging.consume.body', consumeInfo.msg.content.toString());
      },
    });
  }
}
