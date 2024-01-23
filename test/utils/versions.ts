import { readFileSync } from 'fs';
import { dirname } from 'path';
import { instrumentationsVersionManager } from '../helpers/InstrumentationsVersionManager';
import {runOneTimeWrapper} from "@lumigo/node-core/lib/common";

const VERSION_UNDER_TEST =
  process.env.INSTRUMENTATION_UNDER_TEST &&
  process.env.INSTRUMENTATION_UNDER_TEST.length > 0 &&
  process.env.VERSION_UNDER_TEST &&
  process.env.VERSION_UNDER_TEST.length > 0
    ? process.env.VERSION_UNDER_TEST
    : undefined;

export function versionsToTest(instrumentationName: string, packageName: string) {
  const runtime = process.version;
  if (VERSION_UNDER_TEST) {
    return [VERSION_UNDER_TEST];
  }
  const allVersions = readFileSync(
    `${dirname(
      dirname(__dirname)
    )}/src/instrumentations/${instrumentationName}/tested_versions/${runtime}/${packageName}`
  )
    .toString()
    .split('\n')
    .filter(Boolean);
  const supportedVersions = allVersions.filter((version) => !version.startsWith('!'));
  const unsupportedVersions = allVersions
    .filter((version) => version.startsWith('!'))
    .map((version) => {
      // strip ! prefix from version
      return version.slice(1);
    });
  unsupportedVersions.forEach((version) => {
    instrumentationsVersionManager.addPackageUnsupportedVersion(packageName, version);
  });
  return supportedVersions;
}
