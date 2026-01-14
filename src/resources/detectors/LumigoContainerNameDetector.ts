/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ResourceDetector, DetectedResource } from '@opentelemetry/resources';
import { logger } from '../../logging';
import { ATTR_K8S_CONTAINER_NAME } from '@opentelemetry/semantic-conventions/incubating';

export const LUMIGO_CONTAINER_NAME_ENV_VAR = 'LUMIGO_CONTAINER_NAME';

/**
 * LumigoTagDetector provides resource attributes with lumigo tag
 * set by the application in env var
 */
export class LumigoContainerNameDetector implements ResourceDetector {
  readonly containerName: string | undefined;

  constructor() {
    this.containerName = process.env[LUMIGO_CONTAINER_NAME_ENV_VAR];
  }

  detect(): DetectedResource {
    if (!this.containerName) {
      return { attributes: {} };
    } else {
      return {
        attributes: {
          [ATTR_K8S_CONTAINER_NAME]: this.containerName,
        },
      };
    }
  }
}
