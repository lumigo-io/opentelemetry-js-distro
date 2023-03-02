import { diag, Context, TextMapSetter } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

/*
 * List of keys in the carrier that signal the need not to inject
 * traceparent/tracestate headers, e.g., when the outgoing request
 * is signed with a digest, abnd us adding HTTP headers would
 * invalidate the signature.
 */
const contextKeysSkipInject = [
  'x-amz-content-sha256', // Amazon Sigv4, see https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
];

export class LumigoW3CTraceContextPropagator extends W3CTraceContextPropagator {
  override inject(context: Context, carrier: unknown, setter: TextMapSetter): void {
    if (typeof carrier === 'object') {
      diag.error(`Carrier keys: ${Object.keys(carrier).map(key => key.toLowerCase())}`)
      for (const key of contextKeysSkipInject) {
        if (Object.keys(carrier).map(key => key.toLowerCase()).includes(key)) {
          diag.debug(`Skipping injection of trace context due to key '${key}' in carrier`);
          return;
        }
      }
    }

    super.inject(context, carrier, setter);
  }
}
