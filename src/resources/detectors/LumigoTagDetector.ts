/* eslint-disable @typescript-eslint/no-unused-vars */
import { Detector, Resource, ResourceDetectionConfig } from '@opentelemetry/resources';
import {logger} from "../../logging";

export const LUMIGO_TAG_ATTRIBUTE = 'lumigo.tag';
export const LUMIGO_TAG_ENV_VAR = 'LUMIGO_TAG';

/**
 * LumigoTagDetector provides resource attributes with lumigo tag
 * set by the application in env var
 */
export class LumigoTagDetector implements Detector {
  readonly tag: string | undefined

  constructor() {
    this.tag = process.env[LUMIGO_TAG_ENV_VAR];
  }

  async detect(_config?: ResourceDetectionConfig): Promise<Resource> {
    return new Promise((resolve) => {
      if (!this.tag) {
        resolve(Resource.empty());
      } else if (this.tag.includes(';')) {
        logger.warn(`Lumigo tag contains a semicolon, which is not allowed. The tag will be ignored.`, { tag: this.tag });
        resolve(Resource.empty());
      } else {
        resolve(new Resource({
          [LUMIGO_TAG_ATTRIBUTE]: this.tag,
        }));
      }
    });
  }
}
