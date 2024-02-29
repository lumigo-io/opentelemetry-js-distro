import { readFileSync } from 'fs';
import { SpanKind } from '@opentelemetry/api';
import { BasicTracerProvider, Span } from '@opentelemetry/sdk-trace-base';

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

export function readSpanDump(spanDumpPath: string): Span[] {
    try {
        return readFileSync(spanDumpPath, 'utf-8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    } catch (err) {
        // Might be we try to read as a new span is being written, and the JSON is still malformed
        return [];
    }
}

export const rootSpanWithAttributes = (attributes: Record<string, any>): Span => {
    const provider = new BasicTracerProvider();
    const root = provider.getTracer('default').startSpan('root');
    root.setAttributes(attributes);

    return root as Span;
  };
