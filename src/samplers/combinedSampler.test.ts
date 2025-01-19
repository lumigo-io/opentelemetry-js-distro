import { CombinedSampler, getCombinedSampler } from './combinedSampler';
import { LumigoSampler } from './lumigoSampler';
import { MongodbSampler } from './mongodbSampler';
import { Context, SpanKind } from '@opentelemetry/api';
import { SamplingDecision } from '@opentelemetry/sdk-trace-base';

describe('CombinedSampler', () => {
  let lumigoSampler: LumigoSampler;
  let mongodbSampler: MongodbSampler;
  let combinedSampler: CombinedSampler;

  beforeEach(() => {
    lumigoSampler = new LumigoSampler();
    mongodbSampler = new MongodbSampler();
    combinedSampler = new CombinedSampler(lumigoSampler, mongodbSampler);
  });

  it('should return NOT_RECORD if any sampler returns NOT_RECORD', () => {
    jest
      .spyOn(lumigoSampler, 'shouldSample')
      .mockReturnValue({ decision: SamplingDecision.NOT_RECORD });
    jest
      .spyOn(mongodbSampler, 'shouldSample')
      .mockReturnValue({ decision: SamplingDecision.RECORD_AND_SAMPLED });

    const result = combinedSampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      {},
      []
    );
    expect(result.decision).toBe(SamplingDecision.NOT_RECORD);
  });

  it('should return RECORD_AND_SAMPLED if all samplers return RECORD_AND_SAMPLED', () => {
    jest
      .spyOn(lumigoSampler, 'shouldSample')
      .mockReturnValue({ decision: SamplingDecision.RECORD_AND_SAMPLED });
    jest
      .spyOn(mongodbSampler, 'shouldSample')
      .mockReturnValue({ decision: SamplingDecision.RECORD_AND_SAMPLED });

    const result = combinedSampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      {},
      []
    );
    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it('should return RECORD_AND_SAMPLED if no samplers return NOT_RECORD', () => {
    jest
      .spyOn(lumigoSampler, 'shouldSample')
      .mockReturnValue({ decision: SamplingDecision.RECORD_AND_SAMPLED });
    jest
      .spyOn(mongodbSampler, 'shouldSample')
      .mockReturnValue({ decision: SamplingDecision.RECORD });

    const result = combinedSampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      {},
      []
    );
    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });
});
