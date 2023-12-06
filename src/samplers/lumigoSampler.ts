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
    const url = extractUrl(attributes);
    console.log('url', url);
    if (url && shouldSkipSpanOnRouteMatch(url)) {
      console.debug(
        `Dropping trace for url '${url} because it matches the auth-filter regex specified by 'LUMIGO_AUTO_FILTER_HTTP_ENDPOINTS_REGEX'`
      );
      decision = SamplingDecision.NOT_RECORD;
    }

    return { decision: decision };
  }
}

export const extractUrl = (attributes: Attributes): string | null => {
  if (!attributes) {
    return null;
  }

  // Try building a raw url from given attributes
  let raw_url = null;
  if (attributes['http.url']) {
    raw_url = attributes['http.url'].toString();
  }
  if (
    !raw_url &&
    attributes['http.scheme'] &&
    attributes['http.host'] &&
    attributes['http.target']
  ) {
    raw_url = `${attributes['http.scheme']}://${attributes['http.host']}${attributes['http.target']}`;
  }

  if (!raw_url) {
    return null;
  }

  const parsedUrl = new URL(raw_url);
  const path = parsedUrl.pathname && parsedUrl.pathname !== '/' ? parsedUrl.pathname : '';
  return `${parsedUrl.protocol}//${parsedUrl.host}${path}${parsedUrl.search}`;
};

export const shouldSkipSpanOnRouteMatch = (url: string): boolean => {
  if (!url) {
    return false;
  }

  if (!process.env.LUMIGO_AUTO_FILTER_HTTP_ENDPOINTS_REGEX) {
    return false;
  }

  if (process.env.LUMIGO_AUTO_FILTER_HTTP_ENDPOINTS_REGEX) {
    let regex: null | RegExp = null;
    try {
      regex = new RegExp(process.env.LUMIGO_AUTO_FILTER_HTTP_ENDPOINTS_REGEX);
      return regex.test(url);
    } catch (err) {
      console.error(
        `Invalid regex in 'LUMIGO_AUTO_FILTER_HTTP_ENDPOINTS_REGEX': '${process.env.LUMIGO_AUTO_FILTER_HTTP_ENDPOINTS_REGEX}'`
      );
      return false;
    }
  }
  return false;
};

export const getLumigoSampler = () => {
  const lumigoSampler = new LumigoSampler();
  return new ParentBasedSampler({
    root: lumigoSampler,
    remoteParentSampled: lumigoSampler,
    localParentSampled: lumigoSampler,
  });
};
