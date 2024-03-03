import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import { Span } from '@opentelemetry/api';
import { FastifyInstrumentation, FastifyRequestInfo } from '@opentelemetry/instrumentation-fastify';
import { contentType, scrubHttpPayload } from '../../tools/payloads';
import { getSpanAttributeMaxLength } from '../../utils';
import { Instrumentor } from '../instrumentor';

export default class LumigoFastifyInstrumentation extends Instrumentor<FastifyInstrumentation> {
  getInstrumentedModules(): string[] {
    return ['fastify'];
  }

  getInstrumentation(): FastifyInstrumentation {
    return new FastifyInstrumentation({
      requestHook: function (span: Span, info: FastifyRequestInfo) {
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
      },
    });
  }
}
