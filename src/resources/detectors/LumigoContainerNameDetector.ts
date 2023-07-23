/* eslint-disable @typescript-eslint/no-unused-vars */
import { Detector, Resource, ResourceDetectionConfig } from '@opentelemetry/resources';
import { logger } from '../../logging';
import {SemanticResourceAttributes} from "@opentelemetry/semantic-conventions";

export const LUMIGO_CONTAINER_NAME_ENV_VAR = 'LUMIGO_CONTAINER_NAME';

/**
 * LumigoTagDetector provides resource attributes with lumigo tag
 * set by the application in env var
 */
export class LumigoContainerNameDetector implements Detector {
  readonly containerName: string | undefined;

  constructor() {
    this.containerName = process.env[LUMIGO_CONTAINER_NAME_ENV_VAR];
  }

  async detect(_config?: ResourceDetectionConfig): Promise<Resource> {
    return new Promise((resolve) => {
      if (!this.containerName) {
        resolve(Resource.empty());
      } else {
        resolve(
          new Resource({
            [SemanticResourceAttributes.K8S_CONTAINER_NAME]: this.containerName,
          })
        );
      }
    });
  }
}
