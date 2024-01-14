import { readFileSync } from 'fs';
import { SpanKind } from '@opentelemetry/api';

type AttributeValue = string | number | boolean | string[] | number[] | boolean[];

export interface Span {
    id: string;
    parentId?: string;
    name: string;
    kind: number;
    attributes: {
        [key: string]: AttributeValue
    },
    resource: {
        attributes: {
            [key: string]: AttributeValue
        }
    }
}

export function getSpanByName(spans: Span[] = [], spanName: string) {
    return spans.find((span) => span.name === spanName);
}

export function getSpanByKind(spans: Span[] = [], spanKindValue: SpanKind): Span {
    return spans.find((span) => span.kind === spanKindValue) as Span;
}

export function getSpansByKind(spans: Span[] = [], spanKindValue: SpanKind): Span[] {
    return spans.filter((span) => span.kind === spanKindValue);
}

export function readSpanDump(spanDumpPath: string): Span[] {
    try {
        return readFileSync(spanDumpPath, 'utf-8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    } catch (err) {
        // Might be we try to read as a new span is being written, and the JSON is still malformed
        return [];
    }
}
