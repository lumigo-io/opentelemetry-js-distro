// @ts-ignore
import {
  callContainer,
  executeNpmScriptWithCallback,
} from './helpers/helpers';

describe('component and compatibility tests for all versions of supported instrumentation', function () {
    let app;
    afterEach(() => {
        if (app) app.kill();
    });
    // TODO broke this: dependencies determined by circle-ci
    // for each combination of dependency versions
    dependencyMatrix.forEach((dependencyVersions) => {
        it(`test ${generateTestName(dependencyVersions)} on node@${process.version}`, async () => {
            jest.setTimeout(30000);
            let resolver;
            const foundTransaction = (resolver, value) => resolver(value);
            const waitForTransactionId = new Promise((resolve) => {
                resolver = resolve;
            });
            app = await executeNpmScriptWithCallback(
                './src/test/component/node',
                (port: number) =>
                    callContainer(port, 'invoke-requests', 'get', {
                        a: '1',
                    }),
                (data: string|Buffer|any) => {
                    const dataStr = data.toString();
                    const transactionRegex = new RegExp(".*(traceId): '(.*)',", 'g');
                    const transactionRegexMatch = transactionRegex.exec(dataStr);
                    if (transactionRegexMatch && transactionRegexMatch.length >= 3) {
                        foundTransaction(resolver, transactionRegexMatch[2]);
                    }
                },
                'start:injected',
                generateEnvironmentVariables(dependencyVersions)
            );
            const transactionId = await waitForTransactionId;
            expect(transactionId).toBeTruthy();
        });
    });
});

const generateTestName = (dependencyVersions: any) => {
    let testName = [];
    for (let dependency in dependencyVersions) {
        let version = dependencyVersions[dependency];
        testName.push(`${dependency}@${version === "" ? "latest" : version}`)
    }
    return testName.join(", ");
};

const generateEnvironmentVariables = (dependencyVersions: any) => {
    let result = {
        LUMIGO_TOKEN: 't_123321',
        LUMIGO_DEBUG_SPANDUMP: 'true',
        LUMIGO_SERVICE_NAME: 'express-js',
        LUMIGO_DEBUG: true,
    };
    for (let dependency in dependencyVersions) {
        let variableName = dependency.replace(/[.-@\\\/]]/g, "_").toUpperCase();
        result[variableName] = dependencyVersions[dependency];
    }
    return result;
};