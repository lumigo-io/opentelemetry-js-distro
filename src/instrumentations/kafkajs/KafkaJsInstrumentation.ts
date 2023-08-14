import { KafkaJsInstrumentation } from 'opentelemetry-instrumentation-kafkajs';
import { Instrumentor } from '../instrumentor';

export default class LumigoKafkaJsInstrumentation extends Instrumentor<KafkaJsInstrumentation> {
  getInstrumentedModule(): string {
    return 'kafkajs';
  }

  getInstrumentation(): KafkaJsInstrumentation {
    return new KafkaJsInstrumentation({
      /*publishHook: (span: Span, publishInfo: PublishInfo) => {
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
            ScrubContext.HTTP_REQUEST_QUERY,
            getSpanAttributeMaxLength()
          )
        );
      },*/
    });
  }
}
