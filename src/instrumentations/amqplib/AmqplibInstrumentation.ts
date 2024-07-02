import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import type { Span } from '@opentelemetry/api';
import {
  AmqplibInstrumentation,
  ConsumeInfo,
  PublishInfo,
} from '@opentelemetry/instrumentation-amqplib';
import { getSpanAttributeMaxLength } from '../../utils';
import { Instrumentor } from '../instrumentor';

export default class LumigoAmqplibInstrumentation extends Instrumentor<AmqplibInstrumentation> {
  getInstrumentedModule(): string {
    return 'amqplib';
  }

  getInstrumentation(): AmqplibInstrumentation {
    return new AmqplibInstrumentation({
      publishHook: (span: Span, publishInfo: PublishInfo) => {
        span.setAttribute(
          'messaging.publish.body',
          CommonUtils.payloadStringify(
            publishInfo.content.toString(),
            ScrubContext.HTTP_REQUEST_QUERY,
            getSpanAttributeMaxLength()
          )
        );
      },
      consumeHook: (span: Span, consumeInfo: ConsumeInfo) => {
        span.setAttribute(
          'messaging.consume.body',
          CommonUtils.payloadStringify(
            consumeInfo.msg.content.toString(),
            ScrubContext.HTTP_RESPONSE_BODY,
            getSpanAttributeMaxLength()
          )
        );
      },
    });
  }
}
