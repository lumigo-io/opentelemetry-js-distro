import fs from "fs";
import {InstrumentationTest} from "../instrumentationsTests/InstrumentationTest";

export function determineIfSpansAreReady(
    dependencyTest: InstrumentationTest,
    path: string,
    resolve: (value: unknown) => void
) {
    const allFileContents = fs.readFileSync(path, 'utf-8');
    const lines = allFileContents.split(/\r?\n/).filter((l) => l !== '');
    dependencyTest.spansReadyCondition(lines, resolve);
}


export const getDirectories = source =>
    fs.readdirSync(source, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)