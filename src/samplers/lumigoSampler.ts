import { Sampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-base';
import { Context, Link, Attributes, SpanKind } from '@opentelemetry/api';
import { SamplingResult, SamplingDecision } from '@opentelemetry/sdk-trace-base';
import {stringify} from "querystring";

export class LumigoSampler implements Sampler {
  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    links: Link[]
  ): SamplingResult {
    // TODO: Delete this log line when done debugging
    console.info('LumigoSampler.shouldSample', {
      context,
      traceId,
      spanName,
      spanKind,
      attributes,
      links,
    });

    let decision = SamplingDecision.RECORD_AND_SAMPLED
    const url = extractUrl(attributes)
    if (url && shouldSkipSpanOnRouteMatch(url)) {
      console.debug(`Dropping trace for url '${url} because it matches the auth-filter regex specified by 'LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX'`)
      decision = SamplingDecision.NOT_RECORD
    }

    return { decision: decision };
  }
}

const extractUrl = (attributes: Attributes): string | null => {
  if (!attributes) {
    return null
  }

  // TODO: Check if this has the port in it, and if not see were we can get it from
  // TODO: Stop query params if found
  if (attributes['http.url']) {
    return attributes['http.url'].toString()
  }

  // TODO: Strip query params from path if found
  // http / https + domain.com:port + /path
  if (attributes['http.schema'] && attributes['http.host'] && attributes['http.target']) {
    return `${attributes['http.schema']}://${attributes['http.host']}${attributes['http.target']}`
  }

  // Not enough info to extract the url
  return null
}

const shouldSkipSpanOnRouteMatch = (url: string): boolean => {
  if (!url) {
    return false
  }

  if (!process.env.LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX) {
    return false
  }

  if (process.env.LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX) {
    let regex: null | RegExp = null
    try {
      regex = new RegExp(process.env.LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX)
    }
    catch (err) {
        console.error(`Invalid regex in 'LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX': '${process.env.LUMIGO_FILTER_HTTP_ENDPOINTS_REGEX}'`)
        return false
    }

    return regex.test(url)
  }
  return false
}

export const getLumigoSampler = () => {
  const lumigoSampler = new LumigoSampler();
  return new ParentBasedSampler({
    root: lumigoSampler,
    remoteParentSampled: lumigoSampler,
    localParentSampled: lumigoSampler,
  });
};
