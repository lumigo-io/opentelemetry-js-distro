import { Sampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-base'
import {Context, Link, Attributes, SpanKind} from "@opentelemetry/api";
import { SamplingResult, SamplingDecision } from "@opentelemetry/sdk-trace-base";

export class LumigoSampler implements Sampler {
    shouldSample(context: Context, traceId: string, spanName: string, spanKind: SpanKind, attributes: Attributes, links: Link[]): SamplingResult {
        // TODO: Delete this log line when done debugging
        console.info('LumigoSampler.shouldSample', {context, traceId, spanName, spanKind, attributes, links})
        return {decision: SamplingDecision.RECORD_AND_SAMPLED};
    }
}

export const getLumigoSampler = () => {
    const lumigoSampler = new LumigoSampler()
    return new ParentBasedSampler({
        root: lumigoSampler,
        remoteParentSampled: lumigoSampler,
        localParentSampled: lumigoSampler,
    });
}
