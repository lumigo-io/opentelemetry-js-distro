import { Sampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-base';
import { Context, Link, Attributes, SpanKind } from '@opentelemetry/api';
import { SamplingResult, SamplingDecision } from '@opentelemetry/sdk-trace-base';

export class LumigoSampler implements Sampler {
  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    links: Link[]
  ): SamplingResult {
    let decision = SamplingDecision.RECORD_AND_SAMPLED;
    const endpoint = extractEndpoint(attributes, spanKind);
    if (endpoint) {
      if (spanKind === SpanKind.CLIENT && doesMatchClientSpanFilteringRegexes(endpoint)) {
        console.debug(
          `Dropping trace for endpoint '${endpoint} because it matches the filter regex specified by 'LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX_CLIENT'`
        );
        decision = SamplingDecision.NOT_RECORD;
      }
      if (
        decision !== SamplingDecision.NOT_RECORD &&
        spanKind === SpanKind.SERVER &&
        doesMatchServerSpanFilteringRegexes(endpoint)
      ) {
        console.debug(
          `Dropping trace for endpoint '${endpoint} because it matches the filter regex specified by 'LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX_SERVER'`
        );
        decision = SamplingDecision.NOT_RECORD;
      }
      if (
        decision !== SamplingDecision.NOT_RECORD &&
        doesMatchGeneralSpanFilteringRegexes(endpoint)
      ) {
        console.debug(
          `Dropping trace for endpoint '${endpoint} because it matches the filter regex specified by 'LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX'`
        );
        decision = SamplingDecision.NOT_RECORD;
      }
    }

    return { decision: decision };
  }
}

export const extractEndpoint = (attributes: Attributes, spanKind: SpanKind): string | null => {
  if (spanKind === SpanKind.CLIENT) {
    const endpoint_attr = attributes['url.full'] || attributes['http.url'];
    return endpoint_attr ? endpoint_attr.toString() : null;
  } else if (spanKind === SpanKind.SERVER) {
    const endpoint_attr = attributes['url.path'] || attributes['http.target'];
    return endpoint_attr ? endpoint_attr.toString() : null;
  }

  return null;
};

export const doesMatchClientSpanFilteringRegexes = (endpoint: string): boolean => {
  if (!endpoint || !process.env.LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX_CLIENT) {
    return false;
  }

  const regexes = parseStringToArray(process.env.LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX_CLIENT);
  return doesEndpointMatchRegexes(endpoint, regexes);
};

export const doesMatchServerSpanFilteringRegexes = (endpoint: string): boolean => {
  if (!endpoint || !process.env.LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX_SERVER) {
    return false;
  }

  const regexes = parseStringToArray(process.env.LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX_SERVER);
  return doesEndpointMatchRegexes(endpoint, regexes);
};

export const doesMatchGeneralSpanFilteringRegexes = (endpoint: string): boolean => {
  if (!endpoint || !process.env.LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX) {
    return false;
  }

  const regexes = parseStringToArray(process.env.LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX);
  return doesEndpointMatchRegexes(endpoint, regexes);
};

export const doesEndpointMatchRegexes = (endpoint: string, regexes: string[]): boolean => {
  if (!endpoint || !regexes) {
    return false;
  }

  for (const rawRegex of regexes) {
    try {
      if (new RegExp(rawRegex).test(endpoint)) {
        return true;
      }
    } catch (err) {
      console.error(`Invalid regex: '${rawRegex}', skipping it.`);
    }
  }

  return false;
};

export const parseStringToArray = (rawArray: string): string[] => {
  try {
    const parsedArray = JSON.parse(rawArray);
    if (Array.isArray(parsedArray) && !parsedArray.some((e) => typeof e !== 'string')) {
      return parsedArray;
    }
  /* eslint-disable no-empty */
  } catch (err) { }

  console.error(`Invalid array of strings format: '${rawArray}'`);
  return [];
};

export const getLumigoSampler = () => {
  const lumigoSampler = new LumigoSampler();
  return new ParentBasedSampler({
    root: lumigoSampler,
    remoteParentSampled: lumigoSampler,
    localParentSampled: lumigoSampler,
  });
};
