import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import { Span } from '@opentelemetry/api';

import { contentType, scrubHttpPayload } from '../../tools/payloads';
import { getSpanAttributeMaxLength, safeExecute } from '../../utils';
import { InstrumentationIfc } from '../hooksIfc';

type FastifyRequestType = { request: any; reply?: any };

export const FastifyHooks: InstrumentationIfc<FastifyRequestType, any> = {
  requestHook(span: Span, { request, reply }: FastifyRequestType): void {
    if (request.query)
      span.setAttribute(
        'http.request.query',
        CommonUtils.payloadStringify(
          request.query,
          ScrubContext.HTTP_REQUEST_QUERY,
          getSpanAttributeMaxLength()
        )
      );
    if (request.headers)
      span.setAttribute(
        'http.request.headers',
        CommonUtils.payloadStringify(
          request.headers,
          ScrubContext.HTTP_REQUEST_HEADERS,
          getSpanAttributeMaxLength()
        )
      );
    if (request.body) {
      span.setAttribute(
        'http.request.body',
        scrubHttpPayload(request.body, contentType(request.headers), ScrubContext.HTTP_REQUEST_BODY)
      );
    }

    let response;
    if (reply) {
      const oldReplyEnd = reply.end;
      const oldReplySend = reply.send;
      reply.send = function (data: any) {
        response = data;
        reply.send = oldReplySend;
        // eslint-disable-next-line prefer-rest-params
        return oldReplySend.apply(reply, arguments);
      };
      reply.end = function () {
        return safeExecute(() => {
          // eslint-disable-next-line prefer-rest-params
          const origRes = oldReplyEnd.apply(reply, arguments);
          if (reply.getHeaders())
            span.setAttribute(
              'http.response.headers',
              CommonUtils.payloadStringify(
                reply.getHeaders(),
                ScrubContext.HTTP_RESPONSE_HEADERS,
                getSpanAttributeMaxLength()
              )
            ); // TODO This is not compliant with the HTTP semantic conventions
          if (response)
            span.setAttribute(
              'http.response.body',
              scrubHttpPayload(
                response,
                contentType(reply.getHeaders()),
                ScrubContext.HTTP_RESPONSE_BODY
              )
            );
          if (reply.body)
            span.setAttribute(
              'http.request.body',
              scrubHttpPayload(
                reply.body,
                contentType(reply.headers),
                ScrubContext.HTTP_REQUEST_BODY
              )
            );
          reply.end = oldReplyEnd;
          return origRes;
        })();
      };
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  responseHook(span: Span, response: any): void {},
};
