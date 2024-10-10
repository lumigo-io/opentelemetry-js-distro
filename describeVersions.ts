import {versionsToTest} from "./test/utils/versions";

global.describeVersions = (instrumentationName, versionName) => {
  const versions = versionsToTest(instrumentationName, versionName)
  if (versions.length === 0) {
    return () => global.describe(`${instrumentationName} (package: ${versionName})`, () => {
      global.it(`Skipping tests, found no new versions to test`, () => {});
    });
  }
  return global.describe.each(versions)
}