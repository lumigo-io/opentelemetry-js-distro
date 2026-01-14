/* eslint-disable @typescript-eslint/no-unused-vars */
import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import type { ResourceDetector, DetectedResource } from '@opentelemetry/resources';
import { getResourceAttributeMaxLength } from '../../utils';

export class ProcessEnvironmentDetector implements ResourceDetector {
  detect = (): DetectedResource => ({
    attributes: {
      'process.environ': CommonUtils.payloadStringify(
        /*
         * Stringify a shallow copy, as the OpenTelemetry SDK modifes the object
         * in a way that does not play nice with the way we use Symbols in the
         * scrubbing process.
         */
        { ...process.env },
        ScrubContext.PROCESS_ENVIRONMENT,
        getResourceAttributeMaxLength()
      ),
    },
  });
}
