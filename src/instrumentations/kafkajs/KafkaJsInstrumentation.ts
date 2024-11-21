import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import type { Span } from '@opentelemetry/api';
import {
  MessagingDestinationKindValues,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';
import { KafkaJsInstrumentation, MessageInfo } from '@opentelemetry/instrumentation-kafkajs';
import { getSpanAttributeMaxLength } from '../../utils';
import { TracingInstrumentor } from '../instrumentor';

export default class LumigoKafkaJsInstrumentation extends TracingInstrumentor<KafkaJsInstrumentation> {
  getInstrumentedModule(): string {
    return 'kafkajs';
  }

  getInstrumentation(): KafkaJsInstrumentation {
    return new KafkaJsInstrumentation({
      producerHook: (span: Span, messageInfo: MessageInfo) => {
        span.setAttribute(
          'messaging.produce.body',
          CommonUtils.payloadStringify(
            messageInfo.message.value.toString(),
            ScrubContext.HTTP_REQUEST_QUERY,
            getSpanAttributeMaxLength()
          )
        );
        span.setAttribute(
          SemanticAttributes.MESSAGING_DESTINATION_KIND,
          MessagingDestinationKindValues.TOPIC
        );
      },
      consumerHook: (span: Span, messageInfo: MessageInfo) => {
        span.setAttribute(
          'messaging.consume.body',
          CommonUtils.payloadStringify(
            messageInfo.message.value.toString(),
            ScrubContext.HTTP_RESPONSE_BODY,
            getSpanAttributeMaxLength()
          )
        );
        span.setAttribute(
          SemanticAttributes.MESSAGING_DESTINATION_KIND,
          MessagingDestinationKindValues.TOPIC
        );
      },
    });
  }
}
