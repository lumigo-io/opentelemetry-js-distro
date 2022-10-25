
export function getSpanByKind(spans: [], spanKindValue: number) {
    return spans.find((span) => span.kind === spanKindValue);
}