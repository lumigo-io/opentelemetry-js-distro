import { readFileSync } from 'fs';
import { SpanKind } from '@opentelemetry/api';

type AttributeValue = string | number | boolean | string[] | number[] | boolean[];

export interface Span {
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

export function readSpanDump(spanDumpPath: string): Span[] {
    return readFileSync(spanDumpPath, 'utf-8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}
