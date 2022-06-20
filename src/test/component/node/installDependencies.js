const fs = require('fs');
const {spawnSync} = require('child_process');

console.log(`Installing supported dependency versions...`);

const supportedDependencies = require('./package.json').lumigo.supportedDependencies;
spawnSync('npm', ['install']);
fs.mkdirSync('./node_modules/.tmp', { recursive: true});

for (const dependency in supportedDependencies) {
  // install each dependency version and move it to a holding location
  supportedDependencies[dependency].forEach((version) => {
    let fullName = version ? `${dependency}@${version}` : dependency;
    let holdingPath = `./node_modules/.tmp/${fullName}`;
    try {
      fs.accessSync(holdingPath, fs.constants.F_OK);
      console.log(`${fullName} installed`)
    } catch (err) {
      console.log(`Installing ${fullName}`);
      spawnSync('npm', ['install', fullName]);
      spawnSync('mv', [`./node_modules/${dependency}`, holdingPath]);
    }
  });

  // move each dependency version from its holding location to an active module directory
  supportedDependencies[dependency].forEach((version) => {
    let fullName = version ? `${dependency}@${version}` : dependency;
    console.log(`Copying ${fullName}`);
    spawnSync('cp', [`-a`, `./node_modules/.tmp/${fullName}`, `./node_modules/${fullName}`]);
  });
}
console.log(`Supported dependency versions installed successfully.`);
