import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import { Span } from '@opentelemetry/api';
import { Message } from 'kafkajs';
import { KafkaJsInstrumentation } from 'opentelemetry-instrumentation-kafkajs';
import { getSpanAttributeMaxLength } from '../../utils';
import { Instrumentor } from '../instrumentor';

export default class LumigoKafkaJsInstrumentation extends Instrumentor<KafkaJsInstrumentation> {
  getInstrumentedModules(): string[] {
    return ['kafkajs'];
  }

  getInstrumentation(): KafkaJsInstrumentation {
    return new KafkaJsInstrumentation({
      producerHook: (span: Span, topic: string, message: Message) => {
        span.setAttribute(
          'messaging.produce.body',
          CommonUtils.payloadStringify(
            message.value.toString(),
            ScrubContext.HTTP_REQUEST_QUERY,
            getSpanAttributeMaxLength()
          )
        );
      },
      consumerHook: (span: Span, topic: string, message: Message) => {
        span.setAttribute(
          'messaging.consume.body',
          CommonUtils.payloadStringify(
            message.value.toString(),
            ScrubContext.HTTP_RESPONSE_BODY,
            getSpanAttributeMaxLength()
          )
        );
      },
    });
  }
}
