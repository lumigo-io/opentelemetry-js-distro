import { spawnSync } from 'child_process';
import { existsSync, rmSync, unlinkSync } from 'fs';

export const reinstallPackages = (appDir: string) => {
  console.log(`removing node packages from ${appDir}...`);
  if (existsSync(`${appDir}/node_modules`)) {
    rmSync(`${appDir}/node_modules`, {
      recursive: true,
    });
  }

  console.log(`removing package-lock.json from ${appDir}...`);
  if (existsSync(`${appDir}/package-lock.json`)) {
    unlinkSync(`${appDir}/package-lock.json`);
  }

  console.log(`installing node packages from ${appDir}...`);
  const { stderr, status, error } = spawnSync('npm', ['install', '--quiet'], {
    cwd: appDir,
  });

  if (error) {
    throw error;
  }

  if (Number.isInteger(status) && status! > 0) {
    throw new Error(`The installation of app dependencies failed with exit code '${status}'; stderr: ${stderr.toString()}`)
  }
};

export const installPackage = (appDir: string, packageName: string, packageVersion: string) => {
  console.log(`installing ${packageName}@${packageVersion} into ${appDir}...`);
  const { error } = spawnSync('npm', ['install', '--quiet', `${packageName}@${packageVersion}`], {
    cwd: appDir,
  });

  if (error) {
    throw error;
  }
};

export const installPackages = (appDir: string, packageNames: string[], packageVersion: string) => {
  const qualifiedPackages: string[] = packageNames.map((packageName) => `${packageName}@${packageVersion}`);
  console.log(`installing ${qualifiedPackages.join(', ')} into ${appDir}...`);
  const { error } = spawnSync('npm', ['install', '--quiet', ...qualifiedPackages], {
    cwd: appDir,
  });

  if (error) {
    throw error;
  }
};

export const uninstallPackage = (appDir: string, packageName: string, packageVersion: string) => {
  console.log(`uninstalling ${packageName}@${packageVersion} from ${appDir}...`);
  const { error } = spawnSync('npm', ['uninstall', `${packageName}@${packageVersion}`], {
    cwd: appDir,
  });

  if (error) {
    throw error;
  }
};

export const uninstallPackages = (appDir: string, packageNames: string[], packageVersion: string) => {
  const qualifiedPackages: string[] = packageNames.map((packageName) => `${packageName}@${packageVersion}`);
  console.log(`uninstalling ${qualifiedPackages.join(', ')} from ${appDir}...`);
  const { error } = spawnSync('npm', ['uninstall', ...qualifiedPackages], {
    cwd: appDir,
  });

  if (error) {
    throw error;
  }
};
