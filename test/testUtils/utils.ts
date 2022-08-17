import fs from "fs";
import {InstrumentationTest} from "../helpers/InstrumentationTest";

export function determineIfSpansAreReady(
    dependencyTest: InstrumentationTest,
    path: string,
    resolve: (value: unknown) => void
) {
    const allFileContents = fs.readFileSync(path, 'utf-8');
    const lines = allFileContents.split(/\r?\n/).filter((l) => l !== '');
    dependencyTest.spansReadyCondition(lines, resolve);
}


export const waitAndRunSpansAssertions = async (waitForDependencySpans : Promise<void>, dependencyTest, timeout: number)=>{
    let timeoutHandle: NodeJS.Timeout;
    const timeoutPromise = new Promise((resolve, reject) => {
        timeoutHandle = setTimeout(() => reject("Timed out on waiting for spans to be written to file"), timeout);
    });
    Promise.race([waitForDependencySpans,timeoutPromise]).then(result => {
        clearTimeout(timeoutHandle)
        return result;
    }).then((spans: string[]) => {
        dependencyTest.runTests(spans.map((text) => JSON.parse(text)));
    }).finally(() => clearTimeout(timeoutHandle));
}


export const getDirectories = source =>
    fs.readdirSync(source, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)