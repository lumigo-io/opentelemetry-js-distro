import {
  Sampler,
  ParentBasedSampler,
  SamplingResult,
  SamplingDecision,
} from '@opentelemetry/sdk-trace-base';
import { Context, Link, Attributes, SpanKind } from '@opentelemetry/api';
import { logger } from '../logging';

export class RedisSampler implements Sampler {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    links: Link[]
  ): SamplingResult {
    console.log(`spanName: ${spanName}, attributes: ${JSON.stringify(attributes)}`);

    let decision = SamplingDecision.RECORD_AND_SAMPLED;
    const dbSystem = extractClientAttribute(attributes, 'db.system', spanKind);
    const dbStatement = extractClientAttribute(attributes, 'db.statement', spanKind);

    if (spanKind === SpanKind.CLIENT && matchRedisInfoStatement(spanName, dbSystem, dbStatement)) {
      logger.debug(
        `Dropping span ${spanName} with db.system: ${dbSystem} and db.statement: ${dbStatement}, because LUMIGO_REDUCED_REDIS_INSTRUMENTATION is enabled`
      );
      decision = SamplingDecision.NOT_RECORD;
    }

    return { decision: decision };
  }
}

export const extractClientAttribute = (
  attributes: Attributes,
  attributeName: string,
  spanKind: SpanKind
): string | null => {
  if (attributeName && spanKind === SpanKind.CLIENT) {
    const attributeValue = attributes[attributeName];
    return attributeValue ? attributeValue.toString() : null;
  }

  return null;
};

export const matchRedisInfoStatement = (
  spanName: string,
  dbSystem: string,
  dbStatement: string | null | undefined
): boolean => {
  const reduceRedisInstrumentation = process.env.LUMIGO_REDUCED_REDIS_INSTRUMENTATION;
  let isReducedRedisInstrumentationEnabled: boolean;

  if (reduceRedisInstrumentation == null || reduceRedisInstrumentation === '') {
    isReducedRedisInstrumentationEnabled = true; // Default to true
  } else if (reduceRedisInstrumentation.toLowerCase() === 'true') {
    isReducedRedisInstrumentationEnabled = true;
  } else {
    isReducedRedisInstrumentationEnabled = reduceRedisInstrumentation.toLowerCase() !== 'false';
  }

  // Safely handle null or undefined dbStatement by defaulting to empty string
  const safeDbStatement = dbStatement ?? '';

  // Normalize dbStatement:
  // 1. Remove surrounding double quotes if present.
  // 2. Convert to uppercase for case-insensitive comparison.
  // 3. Trim whitespace.
  const normalizedDbStatement = safeDbStatement
    .replace(/^"(.*)"$/, '$1')
    .toUpperCase()
    .trim();

  // Matches either:
  // - "INFO" alone
  // - "INFO SERVER" (with one or more spaces in between)
  //
  // Does NOT match just "SERVER".
  const infoRegex = /^INFO(\s+SERVER)?$/i;

  return (
    isReducedRedisInstrumentationEnabled &&
    (spanName === 'redis.Info' || (dbSystem === 'redis' && infoRegex.test(normalizedDbStatement)))
  );
};

export const getRedisDBSampler = () => {
  const redisSampler = new RedisSampler();
  return new ParentBasedSampler({
    root: redisSampler,
    remoteParentSampled: redisSampler,
    localParentSampled: redisSampler,
  });
};
