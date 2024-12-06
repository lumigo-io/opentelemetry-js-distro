import {
  Sampler,
  SamplingResult,
  SamplingDecision,
  ParentBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import type { Context, Link, Attributes, SpanKind } from '@opentelemetry/api';

import { LumigoSampler } from './lumigoSampler';
import { MongodbSampler } from './mongodbSampler';
import { RedisSampler } from './redisSampler';

export class CombinedSampler implements Sampler {
  private samplers: Sampler[];

  constructor(...samplers: Sampler[]) {
    this.samplers = samplers;
  }
  /* eslint-disable @typescript-eslint/no-unused-vars */
  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    links: Link[]
  ): SamplingResult {
    // Iterate through each sampler
    for (const sampler of this.samplers) {
      console.log(`spanName: ${spanName}, attributes: ${JSON.stringify(attributes)}`);
      const result = sampler.shouldSample(context, traceId, spanName, spanKind, attributes, links);

      // If any sampler decides NOT_RECORD, we respect that decision
      if (result.decision === SamplingDecision.NOT_RECORD) {
        return result;
      }
    }

    // If none decided to NOT_RECORD, we default to RECORD_AND_SAMPLED
    return { decision: SamplingDecision.RECORD_AND_SAMPLED };
  }
}

export const getCombinedSampler = () => {
  const lumigoSampler = new LumigoSampler();
  const mongodbSampler = new MongodbSampler();
  const redisSampler = new RedisSampler();
  const combinedSampler = new CombinedSampler(lumigoSampler, mongodbSampler, redisSampler);

  return new ParentBasedSampler({
    root: combinedSampler,
    remoteParentSampled: combinedSampler,
    localParentSampled: combinedSampler,
  });
};
