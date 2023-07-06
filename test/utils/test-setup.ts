import { spawnSync } from 'child_process';
import { existsSync, rmdirSync, unlinkSync } from 'fs';

export const reinstallPackages = (appDir: string) => {
  console.log('removing node packages...');
  if (existsSync(`${appDir}/node_modules`)) {
    rmdirSync(`${appDir}/node_modules`, {
      recursive: true,
    });
  }

  console.log('removing package-lock.json...');
  if (existsSync(`${appDir}/package-lock.json`)) {
    unlinkSync(`${appDir}/package-lock.json`);
  }

  console.log('installing node packages...');
  const { error } = spawnSync('npm', ['install', '--quiet'], {
    cwd: appDir,
  });

  if (error) {
    throw error;
  }
};

export const installPackage = (appDir: string, packageName: string, packageVersion: string) => {
  console.log(`installing ${packageName}@${packageVersion}...`);
  const { error } = spawnSync('npm', ['install', '--quiet', `${packageName}@${packageVersion}`], {
    cwd: appDir,
  });

  if (error) {
    throw error;
  }
};

export const uninstallPackage = (appDir: string, packageName: string, packageVersion: string) => {
  console.log(`uninstalling ${packageName}@${packageVersion}...`);
  const { error } = spawnSync('npm', ['uninstall', `${packageName}@${packageVersion}`], {
    cwd: appDir,
  });

  if (error) {
    throw error;
  }
};
