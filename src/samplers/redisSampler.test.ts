import {
  RedisSampler,
  extractClientAttribute,
  matchRedisInfoStatement,
  getRedisDBSampler,
} from './redisSampler';
import { Context, SpanKind, Attributes, Link } from '@opentelemetry/api';
import { SamplingDecision } from '@opentelemetry/sdk-trace-base';
import { logger } from '../logging';

describe('RedisSampler', () => {
  let sampler: RedisSampler;

  beforeEach(() => {
    sampler = new RedisSampler();
    delete process.env.LUMIGO_REDUCED_REDIS_INSTRUMENTATION;
  });

  it('should return RECORD_AND_SAMPLED when dbSystem and dbStatement are not provided', () => {
    const result = sampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      {},
      []
    );
    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it('should return NOT_RECORD when dbSystem is redis and dbStatement is INFO and LUMIGO_REDUCED_REDIS_INSTRUMENTATION is true', () => {
    process.env.LUMIGO_REDUCED_REDIS_INSTRUMENTATION = 'true';
    const attributes: Attributes = { 'db.system': 'redis', 'db.statement': 'INFO' };
    const result = sampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      attributes,
      []
    );
    expect(result.decision).toBe(SamplingDecision.NOT_RECORD);
  });

  it('should return RECORD_AND_SAMPLED when dbSystem is redis and dbStatement is not INFO', () => {
    process.env.LUMIGO_REDUCED_REDIS_INSTRUMENTATION = 'true';
    const attributes: Attributes = { 'db.system': 'redis', 'db.statement': 'SET key value' };
    const result = sampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      attributes,
      []
    );
    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it('should return RECORD_AND_SAMPLED when LUMIGO_REDUCED_REDIS_INSTRUMENTATION is false', () => {
    process.env.LUMIGO_REDUCED_REDIS_INSTRUMENTATION = 'false';
    const attributes: Attributes = { 'db.system': 'redis', 'db.statement': 'INFO' };
    const result = sampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      attributes,
      []
    );
    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it('should return RECORD_AND_SAMPLED when dbSystem and dbStatement are null', () => {
    const attributes: Attributes = { 'db.system': null, 'db.statement': null };
    const result = sampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      attributes,
      []
    );
    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it('should return RECORD_AND_SAMPLED when dbSystem is null and dbStatement is provided', () => {
    const attributes: Attributes = { 'db.system': null, 'db.statement': 'SET key value' };
    const result = sampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      attributes,
      []
    );
    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it('should return RECORD_AND_SAMPLED when dbSystem is provided and dbStatement is null', () => {
    const attributes: Attributes = { 'db.system': 'redis', 'db.statement': null };
    const result = sampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      attributes,
      []
    );
    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });

  it('should return NOT_RECORD when dbSystem is redis and dbStatement is INFO with surrounding quotes', () => {
    process.env.LUMIGO_REDUCED_REDIS_INSTRUMENTATION = 'true';
    const attributes: Attributes = { 'db.system': 'redis', 'db.statement': '"INFO"' };
    const result = sampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      attributes,
      []
    );
    expect(result.decision).toBe(SamplingDecision.NOT_RECORD);
  });

  it('should return NOT_RECORD when dbSystem is redis and dbStatement is INFO SERVER', () => {
    process.env.LUMIGO_REDUCED_REDIS_INSTRUMENTATION = 'true';
    const attributes: Attributes = { 'db.system': 'redis', 'db.statement': 'INFO SERVER' };
    const result = sampler.shouldSample(
      {} as Context,
      'traceId',
      'spanName',
      SpanKind.CLIENT,
      attributes,
      []
    );
    expect(result.decision).toBe(SamplingDecision.NOT_RECORD);
  });
});

describe('extractClientAttribute', () => {
  it('should return the attribute value as string when attributeName is present and spanKind is CLIENT', () => {
    const attributes: Attributes = { 'db.system': 'redis' };
    const result = extractClientAttribute(attributes, 'db.system', SpanKind.CLIENT);
    expect(result).toBe('redis');
  });

  it('should return null when attributeName is not present', () => {
    const attributes: Attributes = {};
    const result = extractClientAttribute(attributes, 'db.system', SpanKind.CLIENT);
    expect(result).toBeNull();
  });

  it('should return null when spanKind is not CLIENT', () => {
    const attributes: Attributes = { 'db.system': 'redis' };
    const result = extractClientAttribute(attributes, 'db.system', SpanKind.SERVER);
    expect(result).toBeNull();
  });
});

describe('matchRedisInfoStatement', () => {
  it('should return true when dbSystem is redis, dbStatement is INFO and LUMIGO_REDUCED_REDIS_INSTRUMENTATION is true', () => {
    process.env.LUMIGO_REDUCED_REDIS_INSTRUMENTATION = 'true';
    const result = matchRedisInfoStatement('redis.Info', 'redis', 'INFO');
    expect(result).toBe(true);
  });

  it('should return false when LUMIGO_REDUCED_REDIS_INSTRUMENTATION is false', () => {
    process.env.LUMIGO_REDUCED_REDIS_INSTRUMENTATION = 'false';
    const result = matchRedisInfoStatement('redis.Info', 'redis', 'INFO');
    expect(result).toBe(false);
  });
});
