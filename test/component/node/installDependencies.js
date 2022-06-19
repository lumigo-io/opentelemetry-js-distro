const {spawnSync} = require('child_process');

const customDependencies = require('./package.json').customDependencies;
spawnSync('npm', ['install']);
spawnSync('mkdir', ['./node_modules/.tmp']);

for (const dependency in customDependencies) {
  // install each dependency version and move it to a holding location
  customDependencies[dependency].forEach((version) => {
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
  customDependencies[dependency].forEach((version) => {
    console.log(`Moving ${dependency}@${version}`);
    if (version) {
      spawnSync('mv', [`./node_modules/.tmp/${dependency}@${version}`, `./node_modules/${dependency}@${version}`]);
    } else {
      spawnSync('mv', [`./node_modules/.tmp/${dependency}`, `./node_modules/${dependency}`]);
    }
  });
}
spawnSync('rm', ['-rf', './node_modules/.tmp']);
console.log(`Installing Deps finished.`);