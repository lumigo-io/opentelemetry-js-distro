// @ts-ignore
import {
  callContainer,
  executeNpmScriptWithCallback,
} from './helpers/helpers';

describe('component compatibility tests for all supported versions of express', function () {
    let app;
    afterEach(() => {
        if (app) app.kill();
    });
    const supportedVersions = require('./node/package.json').lumigo.supportedDependencies["express"];
    supportedVersions.forEach((expressVersion: string) => {
        it(`test transactionId truthy on express@${expressVersion} / node@${process.version}`, async () => {
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
                {
                    LUMIGO_TOKEN: 't_123321',
                    LUMIGO_DEBUG_SPANDUMP: 'true',
                    LUMIGO_SERVICE_NAME: 'express-js',
                    LUMIGO_DEBUG: true,
                    EXPRESS_VERSION: expressVersion,
                }
            );
            const transactionId = await waitForTransactionId;
            expect(transactionId).toBeTruthy();
        });
    });
});
