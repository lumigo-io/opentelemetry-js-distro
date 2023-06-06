/* eslint-disable @typescript-eslint/no-unused-vars */
import { Detector, Resource, ResourceDetectionConfig } from '@opentelemetry/resources';

export const LUMIGO_DISTRO_VERSION = 'lumigo.distro.version';

/**
 * LumigoDistroDetector provides resource attributes documeting which version of the
 * Lumigo Distro for OpenTelemetry is used.
 */
export class LumigoDistroDetector implements Detector {
  readonly version: string;

  constructor(version = 'unknown') {
    this.version = version;
  }

  async detect(_config?: ResourceDetectionConfig): Promise<Resource> {
    return new Promise((resolve) => {
      resolve(
        new Resource({
          [LUMIGO_DISTRO_VERSION]: this.version,
        })
      );
    });
  }
}
