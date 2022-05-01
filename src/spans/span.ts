import { Span } from '@opentelemetry/api';
import { CommonUtils } from '@lumigo/node-core';

export function setSpanAttribute(span: Span, key: string, value: any) {
  span.setAttribute(key, CommonUtils.payloadStringify(value));
}

export function setSpanAttributes(
  span: Span & { attributes: Record<string, string> },
  attributes: Record<string, any>
) {
  Object.entries(attributes).forEach(([key, value]) => setSpanAttribute(span, key, value));
}
