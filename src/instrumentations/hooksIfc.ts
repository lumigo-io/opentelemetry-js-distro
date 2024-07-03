import type { Span } from '@opentelemetry/api';

export interface InstrumentationIfc<Rec, Res> {
  requestHook: (span: Span, request: Rec) => void;
  responseHook: (span: Span, response: Res) => void;
}
