/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ResourceDetector, DetectedResource } from '@opentelemetry/resources';
import { logger } from '../../logging';

export const LUMIGO_TAG_ATTRIBUTE = 'lumigo.tag';
export const LUMIGO_TAG_ENV_VAR = 'LUMIGO_TAG';

/**
 * LumigoTagDetector provides resource attributes with lumigo tag
 * set by the application in env var
 */
export class LumigoTagDetector implements ResourceDetector {
  readonly tag: string | undefined;

  constructor() {
    this.tag = process.env[LUMIGO_TAG_ENV_VAR];
  }

  detect(): DetectedResource {
    if (!this.tag) {
      return { attributes: {} };
    } else if (this.tag.includes(';')) {
      logger.warn(
        `Lumigo tag contains a semicolon, which is not allowed. The tag will be ignored.`,
        { tag: this.tag }
      );
      return { attributes: {} };
    } else {
      return {
        attributes: {
          [LUMIGO_TAG_ATTRIBUTE]: this.tag,
        },
      };
    }
  }
}
