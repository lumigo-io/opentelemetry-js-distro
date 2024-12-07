import {
  Sampler,
  ParentBasedSampler,
  SamplingResult,
  SamplingDecision,
} from '@opentelemetry/sdk-trace-base';
import { Context, Link, Attributes, SpanKind } from '@opentelemetry/api';
import { logger } from '../logging';

export class MongodbSampler implements Sampler {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    links: Link[]
  ): SamplingResult {
    // Note, there is probably a bug in opentelemetry api, making mongoSampler always receives attributes array empty.
    // This makes it impossible to filter based on db.system and db.operation attributes. Filter based on spanName only.
    // Opentemetry version upgrade might fix this issue.
    // https://lumigo.atlassian.net/browse/RD-14250
    let decision = SamplingDecision.RECORD_AND_SAMPLED;
    const dbSystem = extractClientAttribute(attributes, 'db.system', spanKind);
    const dbOperation = extractClientAttribute(attributes, 'db.operation', spanKind);

    if (spanKind === SpanKind.CLIENT && matchMongoIsMaster(spanName, dbSystem, dbOperation)) {
      logger.debug(
        `Drop span ${spanName} with db.system: ${dbSystem} and db.operation: ${dbOperation}, because LUMIGO_REDUCED_MONGO_INSTRUMENTATION is enabled`
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

export const matchMongoIsMaster = (
  spanName: string,
  dbSystem: string,
  dbOperation: string
): boolean => {
  const reduceMongoInstrumentation = process.env.LUMIGO_REDUCED_MONGO_INSTRUMENTATION;
  let isReducedMongoInstrumentationEnabled: boolean;

  if (reduceMongoInstrumentation == null || reduceMongoInstrumentation === '') {
    isReducedMongoInstrumentationEnabled = true; // Default to true
  } else if (reduceMongoInstrumentation.toLowerCase() === 'true') {
    isReducedMongoInstrumentationEnabled = true;
  } else
    isReducedMongoInstrumentationEnabled = reduceMongoInstrumentation.toLowerCase() !== 'false';

  return (
    isReducedMongoInstrumentationEnabled &&
    (spanName == 'mongodb.isMaster' || (dbSystem === 'mongodb' && dbOperation === 'isMaster'))
  );
};

export const getMongoDBSampler = () => {
  const mongodbSampler = new MongodbSampler();
  return new ParentBasedSampler({
    root: mongodbSampler,
    remoteParentSampled: mongodbSampler,
    localParentSampled: mongodbSampler,
  });
};
