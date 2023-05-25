/* eslint-disable @typescript-eslint/no-unused-vars */
import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import { Detector, Resource, ResourceDetectionConfig } from '@opentelemetry/resources';
import { getResourceAttributeMaxLength } from '../../utils';

export class ProcessEnvironmentDetector implements Detector {
  detect = async (_config?: ResourceDetectionConfig): Promise<Resource> =>
    Promise.resolve(
      new Resource({
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
      })
    );
}
