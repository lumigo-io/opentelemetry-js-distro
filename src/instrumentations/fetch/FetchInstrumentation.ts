import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { Instrumentor } from '../instrumentor';

export default class LumigoFetchInstrumentation extends Instrumentor<FetchInstrumentation> {
  getInstrumentedModule(): string {
    // the fetch instrumentation must be applied based on the node runtime version,
    // there is not relevant module to instrument
    return '';
  }

  getInstrumentation(): FetchInstrumentation {
    return new FetchInstrumentation({
      /*applyCustomAttributesOnSpan: (span: Span, request: Request|
        RequestInit, result: Response|FetchError) => {
        span.setAttribute('http.method', config.method);
        span.setAttribute('http.url', config.url);
      }*/
      /*requestHook: function (span: Span, info: FastifyRequestInfo) {
        span.setAttribute(
          'http.request.headers',
          CommonUtils.payloadStringify(
            info.request.headers,
            ScrubContext.HTTP_REQUEST_HEADERS,
            getSpanAttributeMaxLength()
          )
        );
        span.setAttribute(
          'http.request.query',
          CommonUtils.payloadStringify(
            info.request.query,
            ScrubContext.HTTP_REQUEST_QUERY,
            getSpanAttributeMaxLength()
          )
        );
        span.setAttribute(
          'http.request.body',
          scrubHttpPayload(
            info.request.body,
            contentType(info.request.headers),
            ScrubContext.HTTP_REQUEST_BODY
          )
        );
      },*/
    });
  }
}
