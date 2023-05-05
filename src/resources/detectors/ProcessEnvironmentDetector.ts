/* eslint-disable @typescript-eslint/no-unused-vars */
import { CommonUtils, ScrubContext } from '@lumigo/node-core';
import { Detector, Resource, ResourceDetectionConfig } from '@opentelemetry/resources';
import { getMaxSize, extractEnvVars } from '../../utils';

export class ProcessEnvironmentDetector implements Detector {
  detect = async (_config?: ResourceDetectionConfig): Promise<Resource> =>
    Promise.resolve(
      new Resource({
        'process.environ': CommonUtils.payloadStringify(
          extractEnvVars(),
          ScrubContext.PROCESS_ENVIRONMENT,
          getMaxSize()
        ),
      })
    );
}
