const fs = require('fs');
const { execSync } = require('child_process');

const compareVersions = function (a, b) {
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

  const allVersions = [...existingVersions, ...untestedVersions];
  fs.writeFileSync(
    `src/instrumentations/${package}/tested_versions/${package}`,
    allVersions.join('\n') + '\n'
  );
}
