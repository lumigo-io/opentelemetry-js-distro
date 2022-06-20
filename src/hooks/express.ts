import type express from 'express';
import { PatchedRequest } from '@opentelemetry/instrumentation-express/build/src/types';
import { InstrumentationIfc } from './hooksIfc';
import { diag, Span } from '@opentelemetry/api';
import { safeExecute } from '../utils';

type ExpressRequestType = { req: PatchedRequest; res: express.Response };

export const ExpressHooks: InstrumentationIfc<ExpressRequestType, any> = {
  requestHook(span: Span, { req, res }: ExpressRequestType): void {
    diag.debug('opentelemetry-instrumentation-express on requestHook()');
    const oldResEnd = res.end;
    const oldResSend = res.send;
    if (req.query) span.setAttribute('http.request.query', JSON.stringify(req.query));
    if (req.headers) span.setAttribute('http.request.headers', JSON.stringify(req.headers));
    let response;
    res.send = function (data: any) {
      response = data;
      res.send = oldResSend;
      // eslint-disable-next-line prefer-rest-params
      return oldResSend.apply(res, arguments);
    };
    res.end = function () {
      diag.debug('opentelemetry-instrumentation-express on end()');
      return safeExecute(() => {
        // eslint-disable-next-line prefer-rest-params
        const origRes = oldResEnd.apply(res, arguments);
        if (res.getHeaders())
          span.setAttribute('http.response.headers', JSON.stringify(res.getHeaders()));
        if (response) span.setAttribute('http.response.body', JSON.stringify(response));
        if (req.body) span.setAttribute('http.request.body', JSON.stringify(req.body));
        res.end = oldResEnd;
        return origRes;
      })();
    };
  },
  responseHook(span: Span, response: any): void {
    diag.debug('opentelemetry-instrumentation-express on responseHook()');
  },
};
