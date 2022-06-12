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
    const customDependencies = require('./node/package.json').customDependencies;
    for (const dependency in customDependencies) {
        customDependencies[dependency].forEach((version) => {
            it(`test ${dependency}@${version === "" ? "latest" : version} on node@${process.version}`, async () => {
                jest.setTimeout(30000);
                let resolver;
                const foundTransaction = (resolver, value) => resolver(value);
                const waitForTransactionId = new Promise((resolve) => {
                    resolver = resolve;
                });
                app = await executeNpmScriptWithCallback(
                    './src/test/component/node',
                    (port) =>
                        callContainer(port, 'chucknorris', 'get', {
                            a: '1',
                        }),
                    (data) => {
                        const dataStr = data.toString();
                        const transactionRegex = new RegExp(".*(traceId): '(.*)',", 'g');
                        const transactionRegexMatch = transactionRegex.exec(dataStr);
                        if (transactionRegexMatch && transactionRegexMatch.length >= 3) {
                            foundTransaction(resolver, transactionRegexMatch[2]);
                        }
                    },
                    'start:injected',
                    {
                        LUMIGO_TOKEN: 't_123321',
                        LUMIGO_DEBUG_SPANDUMP: 'true',
                        LUMIGO_SERVICE_NAME: 'express-js',
                        LUMIGO_DEBUG: true,
                        EXPRESS_VERSION: version,
                    }
                );
                const transactionId = await waitForTransactionId;
                expect(transactionId).toBeTruthy();
            });
        });
    }
});
