require('jest-json');
require('jest-chain');
const { instrumentationsVersionManager } = require('./test/helpers/InstrumentationsVersionManager');
const fs = require('fs');
const { compareVersions, loadPackageVersionsFromBackup } = require('./scripts/tested-versions');

const oldEnv = Object.assign({}, process.env);
beforeEach(() => {
  process.env = { ...oldEnv };
});

afterEach(() => {
  process.env = { ...oldEnv };
});

beforeAll(() => {
  global.console = require('console');
  require('console-stamp')(global.console);
});

afterAll(() => {
  console.info('Starting afterAll...');
  const versions = instrumentationsVersionManager.getInstrumentationsVersions();
  console.info('Adding tested versions', JSON.stringify(versions));
  const versions_keys = Object.keys(versions);
  if (versions_keys.length) {
    versions_keys.forEach((pkg) => {
      // updated supported versions file
      const testedVersionFolder = `./src/instrumentations/${pkg}/tested_versions`;
      const testVersionsFile = `${testedVersionFolder}/${pkg}`;
      fs.mkdirSync(testedVersionFolder, { recursive: true });
      const versionStrings = versions[pkg].unsupported
        .map((v) => `!${v}`)
        .concat(versions[pkg].supported)
        .concat(loadPackageVersionsFromBackup(pkg))
        .sort(compareVersions)
        .join('\n');
      fs.writeFileSync(testVersionsFile, versionStrings);
      console.info('Finish afterAll, supported version files were updated.');
    });
  } else {
    console.info('Finish afterAll, no versions to update.');
  }
});
