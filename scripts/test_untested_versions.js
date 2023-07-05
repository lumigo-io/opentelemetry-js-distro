const fs = require('fs');
const { execSync } = require('child_process');

const compareVersions = function (a, b) {
  if (!a) return -1;
  if (!b) return 1;
  const aParts = a.split('.');
  const bParts = b.split('.');
  for (let i = 0; i < 3; i++) {
    const aPart = parseInt(aParts[i]);
    const bPart = parseInt(bParts[i]);
    if (aPart < bPart) {
      return -1;
    }
    if (aPart > bPart) {
      return 1;
    }
  }
  return 0;
};

const instrumentationsFolders = fs.readdirSync('src/instrumentations').filter(function (package) {
  const isDirectory = fs.statSync(`src/instrumentations/${package}`).isDirectory();
  const hasTestedVersionsFile =
    fs.existsSync(`src/instrumentations/${package}/tested_versions`) &&
    fs.existsSync(`src/instrumentations/${package}/tested_versions/${package}`);
  return isDirectory && hasTestedVersionsFile;
});

for (const package of instrumentationsFolders) {
  console.info(`\nDiscovering untested versions of ${package}...`);
  const existingVersions = fs
    .readFileSync(`src/instrumentations/${package}/tested_versions/${package}`, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort(compareVersions);
  const highestExistingVersion = existingVersions[existingVersions.length - 1];

  const untestedVersions = Object.keys(
    JSON.parse(execSync(`npm show ${package} time --json`, { encoding: 'utf8' }))
  )
    .filter((version) => {
      const isValidVersion = version.match(/^\d+\.\d+\.\d+$/);
      const isNewerThanExistingVersion = compareVersions(version, highestExistingVersion) > 0;
      return isValidVersion && isNewerThanExistingVersion;
    })
    .sort(compareVersions);

  if (untestedVersions.length === 0) {
    console.info(`No untested versions of ${package} since ${highestExistingVersion} found.`);
  } else {
    // run npm run test:instrumentations -- --testPathPattern=test/instrumentations/<package> on the untested versions
    console.info(
      `\nTesting ${untestedVersions.length} untested versions of ${package} since ${highestExistingVersion}...`
    );
    fs.writeFileSync(
      `src/instrumentations/${package}/tested_versions/${package}`,
      untestedVersions.join('\n') + '\n'
    );
    try {
      execSync(
        `npm run test:instrumentations -- --testPathPattern=test/instrumentations/${package}`,
        {
          stdio: 'inherit',
        }
      );
      console.info(`Testing of ${package} succeeded.`);
    } catch (e) {
      console.warn();
      `Testing of ${package} failed.`;
    } finally {
      console.info(`\nResetting versions of ${package}...`);
      fs.writeFileSync(
        `src/instrumentations/${package}/tested_versions/${package}`,
        existingVersions.join('\n') + '\n'
      );
    }
  }
}
