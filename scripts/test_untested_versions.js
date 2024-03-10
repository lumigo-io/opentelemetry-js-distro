const fs = require('fs');
const { execSync } = require('child_process');
const {
  backupPackageVersions,
  compareVersions,
  deleteBackupPackageVersions,
  loadPackageVersions,
  restorePackageVersionsFromBackup,
} = require('./tested-versions-file-utils');

const packageNameOverrides = {
  '@grpc': '@grpc/grpc-js',
  '@nestjs': '@nestjs/core',
  '@aws-sdk': '@aws-sdk/client-sqs',
}

const isRunningOnCI = process.env['GITHUB_ACTIONS']?.length || process.env['CI'] == 'true';
console.info(`\nTesting untested package versions ${isRunningOnCI ? 'on CI' : 'locally'}...`);
const runtimeVersion = parseInt(process.version.slice(1).split('.')[0]);
console.log(runtimeVersion)
const instrumentationsFolders = fs.readdirSync('src/instrumentations').filter((package) => {
  package = packageNameOverrides[package] || package

  const isDirectory = fs.statSync(`src/instrumentations/${package}`).isDirectory();
  const hasTestedVersionsFile =
    fs.existsSync(`src/instrumentations/${package}/tested_versions`) &&
    fs.existsSync(`src/instrumentations/${package}/tested_versions/${runtimeVersion}/${package}`);
  return isDirectory && hasTestedVersionsFile;
});

let instrumentationToTest = instrumentationsFolders.filter((instrumentation) => {
  return (
    !process.env.INSTRUMENTATION_UNDER_TEST ||
    process.env.INSTRUMENTATION_UNDER_TEST === instrumentation
  );
});

console.info(`\nDiscovering untested versions of: ${instrumentationToTest.join(', ')}`);

const correctedInstrumentationsToTest = instrumentationToTest.map(inst => packageNameOverrides[inst] || inst)
for (const package of correctedInstrumentationsToTest) {
  console.info(`\nDiscovering untested versions of ${package}...`);
  const existingVersions = loadPackageVersions(package);
  const highestExistingVersion = existingVersions[existingVersions.length - 1];

  let untestedVersions = Object.keys(
    JSON.parse(execSync(`npm show ${package} time --json`, { encoding: 'utf8' }))
  );
  if (highestExistingVersion !== undefined) {

    untestedVersions = untestedVersions.filter((version) => {
      const isValidVersion = version.match(/^\d+\.\d+\.\d+$/);
      const isNewerThanExistingVersion =
        isValidVersion && compareVersions(version, highestExistingVersion) > 0;
      return isValidVersion && isNewerThanExistingVersion;
    })
      .sort(compareVersions);
  }

  if (untestedVersions.length === 0) {
    console.info(`No untested versions of ${package} since ${highestExistingVersion} found.`);
  } else {
    // run npm run test:instrumentations -- --testPathPattern=test/instrumentations/<package> on the untested versions
    console.info(
      `\nTesting ${untestedVersions.length} untested versions of ${package} since ${highestExistingVersion}...`
    );
    backupPackageVersions(package);

    // if this is run locally, only test the first and last versions
    untestedVersions =
      isRunningOnCI || untestedVersions.length < 3
        ? untestedVersions
        : [untestedVersions[0], untestedVersions[untestedVersions.length - 1]];

    fs.writeFileSync(
      `src/instrumentations/${package}/tested_versions/${runtimeVersion}/${package}`,
      untestedVersions.join('\n') + '\n'
    );
    try {
      execSync(
        `npm run test:instrumentations${isRunningOnCI ? ':ci' : ''
        } -- --testPathPattern=test/instrumentations/${package}`,
        {
          stdio: 'inherit',
        }
      );
      console.info(`Testing of ${package} succeeded.`);
    } catch (e) {
      console.warn(`Testing of ${package} failed.`);
    } finally {
      if (process.env['GITHUB_ACTIONS']?.length) {
        // we don't want the backup files to be committed on ci runs
        console.info(`\nDeleting backup files of instrumentation versions for ${package}...`);
        deleteBackupPackageVersions(package);
      } else {
        // we don't want the updates committed on local runs
        console.info(`\nRestoring instrumentation versions for ${package}...`);
        restorePackageVersionsFromBackup(package);
      }
    }
  }
}
