/* eslint-disable @typescript-eslint/no-unused-vars */
import { readFileSync } from 'fs';
import { logger } from '../../logging';
import type { ResourceDetector, DetectedResource } from '@opentelemetry/resources';

// From @opentelemetry/semantic-conventions/incubating (ESLint can't resolve exports field)
const ATTR_K8S_POD_UID = 'k8s.pod.uid';

const POD_ID_LENGTH = 36;
const CONTAINER_ID_LENGTH = 64;

/*
 * Detector for the Kubernetes Pod UUID, based on https://github.com/open-telemetry/opentelemetry-python-contrib/pull/1489
 */
export class LumigoKubernetesDetector implements ResourceDetector {
  detect(): DetectedResource {
    try {
      const hostFileContent = readFileSync('/etc/hosts', {
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

      return { attributes: {} };
    }

    let podId: string;

    try {
      podId = get_kubenertes_pod_uid_v1();
    } catch (err) {
      try {
        logger.debug(`No Pod UID v1 found: ${err}`);

        podId = get_kubenertes_pod_uid_v2();
      } catch (err) {
        logger.debug(`No Pod UID v2 found: ${err}`);
      }
    }

    if (!podId) {
      return { attributes: {} };
    }

    return {
      attributes: {
        [ATTR_K8S_POD_UID]: podId,
      },
    };
  }
}

const get_kubenertes_pod_uid_v1 = (): string => {
  const mountinfo = readFileSync('/proc/self/mountinfo', {
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
    throw new Error("No pod-like mountpoint found in '/proc/self/mountinfo'");
  }

  return podMountInfoEntry.split('/pods/')[1].substring(0, POD_ID_LENGTH);
};

const get_kubenertes_pod_uid_v2 = (): string => {
  const cgroups = readFileSync('/proc/self/cgroup', {
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
