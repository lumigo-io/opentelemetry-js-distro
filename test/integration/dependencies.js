import { mkdirSync, writeFileSync, accessSync, constants } from 'fs';
import { spawnSync, execSync } from 'child_process';
import { satisfies } from 'semver';

const install = () => {
    console.log('Installing supported dependency versions...');
    
    let packageJson = require('./package.json');
    let { supportedDependencies } = packageJson.lumigo;
    
    supportedDependencies = writeDependencyVersionsFile(supportedDependencies);
    
    spawnSync('npm', ['install']);
    
    mkdirSync('./node_modules/.tmp', { recursive: true });
    
    for (const dependency in supportedDependencies) {
      installDependencyInTempLocation(supportedDependencies, dependency);
      moveDependencyFromTempToActiveModule(supportedDependencies, dependency);
    }
    console.log('Supported dependency versions installed successfully.');
};

const writeDependencyVersionsFile = (supportedDependencies) => {
    for (let dependency in supportedDependencies) {
        execSync(`npm view ${dependency} versions --json > ${dependency}_versions.json`);
        const versionsFile = `${__dirname}/${dependency}/app/${dependency}_versions.json`;
        supportedDependencies[dependency].versions = require(versionsFile).filter(
            (v) => satisfies(v, supportedDependencies[dependency].satisfies)
        );
        writeFileSync(
            versionsFile,
            JSON.stringify(supportedDependencies[dependency].versions, null, 2)
        );
    }
    return supportedDependencies
}

// install each dependency version and move it to a holding location
const installDependencyInTempLocation = (supportedDependencies, dependency) => {
    supportedDependencies[dependency].versions.forEach((version) => {
        let fullName = version ? `${dependency}@${version}` : dependency;
        let holdingPath = `${__dirname}/${dependency}/app/node_modules/.tmp/${fullName}`;
        try {
            accessSync(holdingPath, fs.constants.F_OK);
            console.info(`${fullName} already installed`);
        } catch (err) {
            console.info(`Installing ${fullName}`);
            spawnSync('npm', ['install', fullName, '--no-save']);
            spawnSync('mv', [`${__dirname}/${dependency}/app/node_modules/${dependency}`, holdingPath]);
        }
    });
}

// move each dependency version from its holding location to an active module directory
const moveDependencyFromTempToActiveModule = (supportedDependencies, dependency) => {
    supportedDependencies[dependency].versions.forEach((version) => {
        let fullName = version ? `${dependency}@${version}` : dependency;
        console.info(`Copying ${fullName}`);
        spawnSync('cp', [`-a`, `${__dirname}/${dependency}/app/node_modules/.tmp/${fullName}`, `${__dirname}/${dependency}/app/node_modules/${fullName}`]);
    });
}

export default { install }