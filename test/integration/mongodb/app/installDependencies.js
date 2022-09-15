const fs = require('fs');
const { spawnSync } = require('child_process');
const {writeDependencyVersionsFile, installDependencyInTempLocation, moveDependencyFromTempToActiveModule} = require("../../commonInstallDependencies");

console.log(`Installing supported dependency versions...`);

let packageJson = require('./package.json');
let { supportedDependencies } = packageJson.lumigo;

supportedDependencies = writeDependencyVersionsFile(supportedDependencies);

spawnSync('npm', ['install']);

fs.mkdirSync('./node_modules/.tmp', { recursive: true });

for (const dependency in supportedDependencies) {
    installDependencyInTempLocation(supportedDependencies, dependency);
    moveDependencyFromTempToActiveModule(supportedDependencies ,dependency);
}
console.log(`Supported dependency versions installed successfully.`);
