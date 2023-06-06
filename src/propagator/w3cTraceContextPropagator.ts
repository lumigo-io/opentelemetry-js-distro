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
      const carrierKeys = Object.keys(carrier).map((key) => key.toLowerCase());
      const carrierFilteredKeys = carrierKeys.filter((key) => contextKeysSkipInject.includes(key));

      if (carrierFilteredKeys.length) {
        diag.debug(
          `Skipping injection of trace context due to keys in carrier: ${carrierFilteredKeys.join(
            ', '
          )}`
        );
        return;
      }
    }

    super.inject(context, carrier, setter);
  }
}
