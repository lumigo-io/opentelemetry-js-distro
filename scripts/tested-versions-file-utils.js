const fs = require('fs');
const semver = require('semver');

const compareVersions = (v1, v2) => semver.compare(v1.replace('!', ''), v2.replace('!', ''));

const getBackupFileName = (pkg) => {
  return `${getFileName(pkg)}.backup`;
};

const getFileName = (pkg) => {
  return `src/instrumentations/${pkg}/tested_versions/${pkg}`;
};

const backupPackageVersions = function (pkg) {
  const versionsFile = getFileName(pkg);
  if (!fs.existsSync(versionsFile)) {
    return;
  }
  fs.copyFileSync(versionsFile, getBackupFileName(pkg));
};

const deleteBackupPackageVersions = function (pkg) {
  fs.unlinkSync(getBackupFileName(pkg));
};

const loadPackageVersions = function (pkg, versionsFile) {
  versionsFile = versionsFile || getFileName(pkg);
  if (!fs.existsSync(versionsFile)) {
    return [];
  }
  return fs
    .readFileSync(versionsFile, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .sort(compareVersions);
};

const loadPackageVersionsFromBackup = function (pkg) {
  return loadPackageVersions(pkg, getBackupFileName(pkg));
};

const restorePackageVersionsFromBackup = function (pkg) {
  const backupVersionsFile = getBackupFileName(pkg);
  if (!fs.existsSync(backupVersionsFile)) {
    return;
  }
  fs.copyFileSync(backupVersionsFile, getFileName(pkg));
  fs.unlinkSync(backupVersionsFile);
};

// export the functions
module.exports = {
  backupPackageVersions,
  compareVersions,
  deleteBackupPackageVersions,
  loadPackageVersions,
  loadPackageVersionsFromBackup,
  restorePackageVersionsFromBackup,
};
