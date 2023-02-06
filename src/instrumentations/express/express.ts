import type express from 'express';

import { Span } from '@opentelemetry/api';

import { safeExecute } from '../../utils';
import { InstrumentationIfc } from '../hooksIfc';

type ExpressRequestType = { req: express.Request; res: express.Response };

export const ExpressHooks: InstrumentationIfc<ExpressRequestType, any> = {
  requestHook(span: Span, { req, res }: ExpressRequestType): void {
    const oldResEnd = res.end;
    const oldResSend = res.send;
    if (req.query) span.setAttribute('http.request.query', JSON.stringify(req.query, undefined, 0));
    if (req.headers) span.setAttribute('http.request.headers', JSON.stringify(req.headers, undefined, 0));
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
          span.setAttribute('http.response.headers', JSON.stringify(res.getHeaders(), undefined, 0)); // TODO This is not compliant with the HTTP semantic conventions
        if (response) span.setAttribute('http.response.body', JSON.stringify(response, undefined, 0));
        if (req.body) span.setAttribute('http.request.body', JSON.stringify(req.body, undefined, 0));
        res.end = oldResEnd;
        return origRes;
      })();
    };
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  responseHook(span: Span, response: any): void {
  },
};
