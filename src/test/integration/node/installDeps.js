const {spawnSync} = require('child_process');

const customDependencies = require('./package.json').customDependecies;
spawnSync('npm', ['install']);
spawnSync('mkdir', ['./node_modules/.tmp']);

for (const dependency in customDependencies) {
  customDependencies[dependency].forEach((version) => {
    console.log(`Installing ${dependency}@${version}`);
    spawnSync('npm', ['install', `${dependency}@${version}`]);
    spawnSync('mv', [`./node_modules/${dependency}`, `./node_modules/.tmp/${dependency}@${version}`]);

  });

  customDependencies[dependency].forEach((version) => {
    console.log(`Moving ${dependency}@${version}`);
    spawnSync('mv', [`./node_modules/.tmp/${dependency}@${version}`, `./node_modules/${dependency}@${version}`]);
  });
}
spawnSync('rm', ['-rf', './node_modules/.tmp']);
console.log(`Installing Deps finished.`);