const {spawnSync} = require('child_process');

console.log(`Installing supported dependency versions...`);

const supportedDependencies = require('./package.json').lumigo.supportedDependencies;
spawnSync('npm', ['install']);
spawnSync('mkdir', ['./node_modules/.tmp']);

for (const dependency in supportedDependencies) {
  // install each dependency version and move it to a holding location
  supportedDependencies[dependency].forEach((version) => {
    console.log(`Installing ${dependency}@${version}`);
    if (version) {
      spawnSync('npm', ['install', `${dependency}@${version}`]);
      spawnSync('mv', [`./node_modules/${dependency}`, `./node_modules/.tmp/${dependency}@${version}`]);
    } else {
      spawnSync('npm', ['install', `${dependency}`]);
      spawnSync('mv', [`./node_modules/${dependency}`, `./node_modules/.tmp/${dependency}`]);
    }
  });

  // move each dependency version from its holding location to an active module directory
  supportedDependencies[dependency].forEach((version) => {
    console.log(`Moving ${dependency}@${version}`);
    if (version) {
      spawnSync('mv', [`./node_modules/.tmp/${dependency}@${version}`, `./node_modules/${dependency}@${version}`]);
    } else {
      spawnSync('mv', [`./node_modules/.tmp/${dependency}`, `./node_modules/${dependency}`]);
    }
  });
}
spawnSync('rm', ['-rf', './node_modules/.tmp']);
console.log(`Supported dependency versions installed successfully.`);
