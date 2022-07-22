const fs = require('fs');
const { spawnSync, execSync } = require('child_process');
const semver = require('semver');

console.log(`Installing supported dependency versions...`);

let packageJson = require('./package.json');
let { supportedDependencies } = packageJson.lumigo;
for (let dependency in supportedDependencies) {
  execSync(`npm view ${dependency} versions --json > ${dependency}_versions.json`);
  supportedDependencies[dependency].versions = require(`./${dependency}_versions.json`).filter(
    (v) => semver.satisfies(v, supportedDependencies[dependency].satisfies)
  );
  fs.writeFileSync(
    `./${dependency}_versions.json`,
    JSON.stringify(supportedDependencies[dependency].versions, null, 2)
  );
}

spawnSync('npm', ['install']);

fs.mkdirSync('./node_modules/.tmp', { recursive: true });

for (const dependency in supportedDependencies) {
  // install each dependency version and move it to a holding location
  supportedDependencies[dependency].versions.forEach((version) => {
    let fullName = version ? `${dependency}@${version}` : dependency;
    let holdingPath = `./node_modules/.tmp/${fullName}`;
    try {
      fs.accessSync(holdingPath, fs.constants.F_OK);
      console.log(`${fullName} installed`);
    } catch (err) {
      console.log(`Installing ${fullName}`);
      spawnSync('npm', ['install', fullName, '--no-save']);
      spawnSync('mv', [`./node_modules/${dependency}`, holdingPath]);
    }
  });

  // move each dependency version from its holding location to an active module directory
  supportedDependencies[dependency].versions.forEach((version) => {
    let fullName = version ? `${dependency}@${version}` : dependency;
    console.log(`Copying ${fullName}`);
    spawnSync('cp', [`-a`, `./node_modules/.tmp/${fullName}`, `./node_modules/${fullName}`]);
  });
}
console.log(`Supported dependency versions installed successfully.`);
