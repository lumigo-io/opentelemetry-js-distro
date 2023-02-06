/* eslint-disable @typescript-eslint/no-unused-vars */
import { logger } from '../../wrapper';
import { Detector, Resource, ResourceDetectionConfig } from '@opentelemetry/resources';

export const LUMIGO_DISTRO_VERSION = 'lumigo.distro.version';

/**
 * LumigoDistroDetector provides resource attributes documeting which version of the
 * Lumigo Distro for OpenTelemetry is used.
 */
export class LumigoDistroDetector implements Detector {
  async detect(_config?: ResourceDetectionConfig): Promise<Resource> {
    return new Promise((resolve) => {
      let distroVersion = 'unknown';
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { version } = require('../../../package.json');
        distroVersion = version;
      } catch (e) {
        logger.debug('Cannot look up Lumigo distro version');
      }

      resolve(
        new Resource({
          [LUMIGO_DISTRO_VERSION]: distroVersion,
        })
      );
    });
  }
}
