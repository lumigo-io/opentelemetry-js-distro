import type express from 'express';
import { PatchedRequest } from '@opentelemetry/plugin-express/build/src/types';
import { InstrumentationIfc } from './hooksIfc';
import { diag, Span } from '@opentelemetry/api';
import { safeExecute } from '../utils';
import { setSpanAttribute } from '../spans/span';

type ExpressRequestType = { req: PatchedRequest; res: express.Response };

export const ExpressHooks: InstrumentationIfc<ExpressRequestType, any> = {
  requestHook(span: Span, { req, res }: ExpressRequestType): void {
    diag.debug('opentelemetry-instrumentation-express on requestHook()');
    const oldResEnd = res.end;
    const oldResSend = res.send;
    if (req.query) setSpanAttribute(span, 'http.request.query', req.query);
    if (req.headers) setSpanAttribute(span, 'http.request.headers', req.headers);
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
        // @ts-ignore
        // eslint-disable-next-line prefer-rest-params
        const origRes = oldResEnd.apply(res, arguments);
        if (res.getHeaders()) setSpanAttribute(span, 'http.response.headers', res.getHeaders());
        if (response) setSpanAttribute(span, 'http.response.body', response);
        if (req.body) setSpanAttribute(span, 'http.request.body', req.body);
        res.end = oldResEnd;
        return origRes;
      })();
    };
  },
  responseHook(span: Span, response: any): void {
    diag.debug('opentelemetry-instrumentation-express on responseHook()');
  },
};
