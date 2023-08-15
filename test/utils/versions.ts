import { readFileSync } from 'fs';
import { dirname } from 'path';
import { instrumentationsVersionManager } from '../helpers/InstrumentationsVersionManager';

export function versionsToTest(instrumentationName: string, packageName: string) {
  const allVersions = readFileSync(
    `${dirname(
      dirname(__dirname)
    )}/src/instrumentations/${instrumentationName}/tested_versions/${packageName}`
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
