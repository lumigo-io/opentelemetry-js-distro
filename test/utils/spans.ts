import { SpanKind } from '@opentelemetry/api';
import { BasicTracerProvider, Span } from '@opentelemetry/sdk-trace-base';

export { Span } from '@opentelemetry/sdk-trace-base';
export { SdkLogRecord } from '@opentelemetry/sdk-logs';

export function getSpanByName(spans: Span[] = [], spanName: string) {
    return spans.find((span) => span.name === spanName);
}

export function getSpanByKind(spans: Span[] = [], spanKindValue: SpanKind): Span {
    return spans.find((span) => span.kind === spanKindValue) as Span;
}

export function getSpansByKind(spans: Span[] = [], spanKindValue: SpanKind): Span[] {
    return spans.filter((span) => span.kind === spanKindValue);
}

export const getSpansByAttribute = (spans: Span[], attributeKey: string, attributeValue: unknown): Span[] => {
    return spans.filter((span) => span.attributes[attributeKey] === attributeValue);
}

export const rootSpanWithAttributes = (attributes: Record<string, any>, kind?: SpanKind): Span => {
    const provider = new BasicTracerProvider();
    const root = provider.getTracer('default').startSpan('root', { kind, attributes });
    root.setAttributes(attributes);

    return root as Span;
  };