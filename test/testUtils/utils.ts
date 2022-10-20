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


export const waitAndRunSpansAssertions = async (waitForDependencySpans : Promise<string[]>, dependencyTest, ms: number, version = "")=>{
    const timeout = new Promise((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
            clearTimeout(timeoutHandle);
            reject(`[${dependencyTest.getName()}@${version}] Timed out waiting for spans in ${ms} ms.`)
        }, ms)
    })
    // @ts-ignore
    const spans: string[] = await Promise.race([waitForDependencySpans, timeout]).finally(()=>clearTimeout(timeout))
    dependencyTest.runTests(spans.map((text) => JSON.parse(text)));
}


export const getDirectories = source =>
    fs.readdirSync(source, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)


export function getAppPort(data: Buffer, resolve, reject) {
    const dataStr = data.toString();
    const portRegex = new RegExp('.*(Listening on port )([0-9]*)', 'g');

    const portRegexMatch = portRegex.exec(dataStr);

    if (portRegexMatch && portRegexMatch.length >= 3) {
        try {
            const port = parseInt(portRegexMatch[2]);
            resolve(port);
        } catch (exception) {
            reject(exception);
        }
    }
}