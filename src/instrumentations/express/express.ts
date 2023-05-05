import type express from 'express';

import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import { Span } from '@opentelemetry/api';

import { getMaxSize, safeExecute } from '../../utils';
import { InstrumentationIfc } from '../hooksIfc';
import { contentType, scrubHttpPayload } from '../../tools/payloads';

type ExpressRequestType = { req: express.Request; res: express.Response };

export const ExpressHooks: InstrumentationIfc<ExpressRequestType, any> = {
  requestHook(span: Span, { req, res }: ExpressRequestType): void {
    const oldResEnd = res.end;
    const oldResSend = res.send;
    if (req.query)
      span.setAttribute(
        'http.request.query',
        CommonUtils.payloadStringify(req.query, ScrubContext.HTTP_REQUEST_QUERY, getMaxSize())
      );
    if (req.headers)
      span.setAttribute(
        'http.request.headers',
        CommonUtils.payloadStringify(req.headers, ScrubContext.HTTP_REQUEST_HEADERS, getMaxSize())
      );
    let response;
    res.send = function (data: any) {
      response = data;
      res.send = oldResSend;
      // eslint-disable-next-line prefer-rest-params
      return oldResSend.apply(res, arguments);
    };
    res.end = function () {
      return safeExecute(() => {
        // eslint-disable-next-line prefer-rest-params
        const origRes = oldResEnd.apply(res, arguments);
        if (res.getHeaders())
          span.setAttribute(
            'http.response.headers',
            CommonUtils.payloadStringify(
              res.getHeaders(),
              ScrubContext.HTTP_RESPONSE_HEADERS,
              getMaxSize()
            )
          ); // TODO This is not compliant with the HTTP semantic conventions
        if (response)
          span.setAttribute(
            'http.response.body',
            scrubHttpPayload(
              response,
              contentType(res.getHeaders()),
              ScrubContext.HTTP_RESPONSE_BODY
            )
          );
        if (req.body)
          span.setAttribute(
            'http.request.body',
            scrubHttpPayload(req.body, contentType(req.headers), ScrubContext.HTTP_REQUEST_BODY)
          );
        res.end = oldResEnd;
        return origRes;
      })();
    };
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  responseHook(span: Span, response: any): void {},
};
