/* eslint-disable @typescript-eslint/no-unused-vars */
import { readFile } from 'fs/promises';
import { logger } from '../../logging';
import { Detector, Resource, ResourceDetectionConfig } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const POD_ID_LENGTH = 36;
const CONTAINER_ID_LENGTH = 64;

/*
 * Detector for the Kubernetes Pod UUID, based on https://github.com/open-telemetry/opentelemetry-python-contrib/pull/1489
 */
export class LumigoKubernetesDetector implements Detector {
  async detect(_config?: ResourceDetectionConfig): Promise<Resource> {
    try {
      const hostFileContent = await readFile('/etc/hosts', {
        flag: 'r',
        encoding: 'utf8',
      });

      const hostFileFirstLine = String(hostFileContent).slice(0, hostFileContent.indexOf('\n'));
      if (!hostFileFirstLine.startsWith('# Kubernetes-managed hosts file')) {
        throw new Error('File /etc/hosts does not seem managed by Kubernetes');
      }
    } catch (ex) {
      logger.debug(
        'LumigoKubernetesDetector does not think this process runs in a Kubernetes pod',
        ex
      );

      return Resource.EMPTY;
    }

    let podId: string;

    try {
      podId = await get_kubenertes_pod_uid_v1();
    } catch (err) {
      try {
        logger.debug(`No Pod UID v1 found: ${err}`);

        podId = await get_kubenertes_pod_uid_v2();
      } catch (err) {
        logger.debug(`No Pod UID v2 found: ${err}`);
      }
    }

    if (!podId) {
      return Resource.EMPTY;
    }

    return new Resource({
      [SemanticResourceAttributes.K8S_POD_UID]: podId,
    });
  }
}

const get_kubenertes_pod_uid_v1 = async (): Promise<string> => {
  const mountinfo = await readFile('/proc/self/mountinfo', {
    flag: 'r',
    encoding: 'utf8',
  });

  const podMountInfoEntry = mountinfo
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !!line)
    .filter((line) => line.length > POD_ID_LENGTH)
    .find((line) => line.indexOf('/pods/') > 0);

  if (!podMountInfoEntry) {
    return Promise.reject(new Error("No pod-like mountpoint found in '/proc/self/mountinfo'"));
  }

  return podMountInfoEntry.split('/pods/')[1].substring(0, POD_ID_LENGTH);
};

const get_kubenertes_pod_uid_v2 = async (): Promise<string> => {
  const cgroups = await readFile('/proc/self/cgroup', {
    flag: 'r',
    encoding: 'utf8',
  });

  return cgroups
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !!line)
    .filter((line) => line.length > CONTAINER_ID_LENGTH)
    .map((line) => {
      const segments = line.split('/');
      if (
        segments.length > 2 &&
        segments[segments.length - 2].startsWith('pod') &&
        segments[segments.length - 2].length === POD_ID_LENGTH + 3
      ) {
        return segments[segments.length - 2].substring(3, POD_ID_LENGTH + 3);
      }

      return segments[segments.length - 2];
    })
    .find((podId) => !!podId);
};
