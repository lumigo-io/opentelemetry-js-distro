import type { ResourceDetector, DetectedResource } from '@opentelemetry/resources';

export const LUMIGO_DISTRO_VERSION = 'lumigo.distro.version';

/**
 * LumigoDistroDetector provides resource attributes documeting which version of the
 * Lumigo Distro for OpenTelemetry is used.
 */
export class LumigoDistroDetector implements ResourceDetector {
  readonly version: string;

  constructor(version = 'unknown') {
    this.version = version;
  }

  detect(): DetectedResource {
    return {
      attributes: {
        [LUMIGO_DISTRO_VERSION]: this.version,
      },
    };
  }
}
