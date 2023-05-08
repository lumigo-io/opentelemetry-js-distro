import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, rmdirSync, unlinkSync } from 'fs';

export const reinstallPackages = (appDir: string) => {
    if (existsSync(`${appDir}/node_modules`)) {
        rmdirSync(`${appDir}/node_modules`, {
            recursive: true,
        });
    }

    if (existsSync(`${appDir}/package-lock.json`)) {
        unlinkSync(`${appDir}/package-lock.json`);
    }

    const { error } = spawnSync('npm', ['install'], {
        cwd: appDir,
    });

    if (error) {
        throw error;
    }
}

export const installPackage = (appDir: string, packageName: string, packageVersion: string) => {
    const { error } = spawnSync('npm', ['install', `${packageName}@${packageVersion}`], {
        cwd: appDir,
    });

    if (error) {
        throw error;
    }
}

export const uninstallPackage = (appDir: string, packageName: string, packageVersion: string) => {
    const { error } = spawnSync('npm', ['uninstall', `${packageName}@${packageVersion}`], {
        cwd: appDir,
    });

    if (error) {
        throw error;
    }
}

export const ensureDirExists = (dirPath: string) => {
    if (!existsSync(dirPath)) {
        mkdirSync(dirPath);
    }
}