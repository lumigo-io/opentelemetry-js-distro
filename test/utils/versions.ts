import { readFileSync } from 'fs';
import { dirname } from 'path';

export function versionsToTest(instrumentationName: string, packageName: string) {
    return readFileSync(`${dirname(dirname(__dirname))}/src/instrumentations/${instrumentationName}/tested_versions/${packageName}`)
        .toString()
        .split('\n')
        .filter(Boolean)
        .filter(version => !version.startsWith('!'));
}