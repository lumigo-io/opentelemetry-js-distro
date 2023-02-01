import { Detector, Resource, ResourceDetectionConfig } from '@opentelemetry/resources';
import { logger } from '../../utils';

/*
 * Wrapper for instances of `Detector` that ensure that,
 * event in case of an error propagating outside of the
 * wrapped detector, an empty `Resource` is returned to the
 * caller.
 */
export class SafeDetector implements Detector {
  readonly wrappedDetector: Detector;

  constructor(wrappedDetector: Detector) {
    this.wrappedDetector = wrappedDetector;
  }

  async detect(config?: ResourceDetectionConfig): Promise<Resource> {
    try {
      return await this.wrappedDetector.detect(config);
    } catch (err) {
      logger.debug(`Error from ${this.wrappedDetector} detector`, err);
      return Resource.EMPTY;
    }
  }
}
