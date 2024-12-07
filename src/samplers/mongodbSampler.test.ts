import { MongodbSampler, extractClientAttribute, matchMongoIsMaster } from './mongodbSampler';
import { Context, SpanKind, Attributes, Link } from '@opentelemetry/api';
import { SamplingDecision } from '@opentelemetry/sdk-trace-base';

describe('MongodbSampler', () => {
  let sampler: MongodbSampler;

  beforeEach(() => {
    sampler = new MongodbSampler();
    delete process.env.LUMIGO_REDUCED_MONGO_INSTRUMENTATION;
  });

  it('should return RECORD_AND_SAMPLED when dbSystem and dbOperation are not provided', () => {
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

  it('should return NOT_RECORD when dbSystem is mongodb and dbOperation is isMaster and LUMIGO_REDUCED_MONGO_INSTRUMENTATION is true', () => {
    process.env.LUMIGO_REDUCED_MONGO_INSTRUMENTATION = 'true';
    const attributes: Attributes = { 'db.system': 'mongodb', 'db.operation': 'isMaster' };
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

  it('should return NOT_RECORD when dbSystem is mongodb and dbOperation is isMaster', () => {
    const attributes: Attributes = { 'db.system': 'mongodb', 'db.operation': 'isMaster' };
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

  it('should return NOT_RECORD when spanName is mongodb.isMaster', () => {
    const attributes: Attributes = {};
    const result = sampler.shouldSample(
      {} as Context,
      'traceId',
      'mongodb.isMaster',
      SpanKind.CLIENT,
      attributes,
      []
    );
    expect(result.decision).toBe(SamplingDecision.NOT_RECORD);
  });

  it('should return RECORD_AND_SAMPLED when dbSystem is mongodb and dbOperation is not isMaster', () => {
    process.env.LUMIGO_REDUCED_MONGO_INSTRUMENTATION = 'true';
    const attributes: Attributes = { 'db.system': 'mongodb', 'db.operation': 'find' };
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

  it('should return RECORD_AND_SAMPLED when LUMIGO_REDUCED_MONGO_INSTRUMENTATION is false', () => {
    process.env.LUMIGO_REDUCED_MONGO_INSTRUMENTATION = 'false';
    const attributes: Attributes = { 'db.system': 'mongodb', 'db.operation': 'isMaster' };
    const result = sampler.shouldSample(
      {} as Context,
      'traceId',
      'mongodb.isMaster',
      SpanKind.CLIENT,
      attributes,
      []
    );
    expect(result.decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
  });
});

describe('extractClientAttribute', () => {
  it('should return the attribute value as string when attributeName is present and spanKind is CLIENT', () => {
    const attributes: Attributes = { 'db.system': 'mongodb' };
    const result = extractClientAttribute(attributes, 'db.system', SpanKind.CLIENT);
    expect(result).toBe('mongodb');
  });

  it('should return null when attributeName is not present', () => {
    const attributes: Attributes = {};
    const result = extractClientAttribute(attributes, 'db.system', SpanKind.CLIENT);
    expect(result).toBeNull();
  });

  it('should return null when spanKind is not CLIENT', () => {
    const attributes: Attributes = { 'db.system': 'mongodb' };
    const result = extractClientAttribute(attributes, 'db.system', SpanKind.SERVER);
    expect(result).toBeNull();
  });
});

describe('doesMatchClientSpanFiltering', () => {
  beforeEach(() => {
    delete process.env.LUMIGO_REDUCED_MONGO_INSTRUMENTATION;
  });
  it('should return true when dbSystem is mongodb, dbOperation is isMaster and LUMIGO_REDUCED_MONGO_INSTRUMENTATION is true', () => {
    process.env.LUMIGO_REDUCED_MONGO_INSTRUMENTATION = 'true';
    const result = matchMongoIsMaster('any', 'mongodb', 'isMaster');
    expect(result).toBe(true);
  });

  it('should return true when dbSystem is mongodb, dbOperation is isMaster', () => {
    const result = matchMongoIsMaster('any', 'mongodb', 'isMaster');
    expect(result).toBe(true);
  });

  it('should return true when spanName is mongodb.isMaster', () => {
    const result = matchMongoIsMaster('mongodb.isMaster', 'any', 'any');
    expect(result).toBe(true);
  });

  it('should return false when dbSystem is not mongodb', () => {
    process.env.LUMIGO_REDUCED_MONGO_INSTRUMENTATION = 'true';
    const result = matchMongoIsMaster('any', 'mysql', 'isMaster');
    expect(result).toBe(false);
  });

  it('should return false when dbOperation is not isMaster', () => {
    process.env.LUMIGO_REDUCED_MONGO_INSTRUMENTATION = 'true';
    const result = matchMongoIsMaster('any', 'mongodb', 'find');
    expect(result).toBe(false);
  });

  it('should return false when LUMIGO_REDUCED_MONGO_INSTRUMENTATION is false', () => {
    process.env.LUMIGO_REDUCED_MONGO_INSTRUMENTATION = 'false';
    const result = matchMongoIsMaster('any', 'mongodb', 'isMaster');
    expect(result).toBe(false);
  });
});
