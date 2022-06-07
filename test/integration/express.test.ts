import {callContainer, executeNpmScriptWithCallback} from "../helpers/helpers";

describe('interface', function () {
    it('ORR AND ADAM', async () => {
        jest.setTimeout(30000);
        let resolver;
        const foundTransaction = (resolver, value) => resolver(value);
        const waitForTransactionId = new Promise(resolve => {
            resolver = resolve;
        });
        await executeNpmScriptWithCallback(
            './test/integration/node',
            port =>
                callContainer(port, "chucknorris", "get", {
                    a: "1"
                }),
            data => {
                const dataStr = data.toString();
                const transactionRegex = new RegExp(".*(traceId): '(.*)',", "g");
                const transactionRegexMatch = transactionRegex.exec(dataStr);
                if (transactionRegexMatch && transactionRegexMatch.length >= 3) {
                    foundTransaction(resolver, transactionRegexMatch[2]);
                }
            },
            "start:injected",
            {
                LUMIGO_TOKEN: "t_123321",
                LUMIGO_DEBUG_SPANDUMP: "true",
                LUMIGO_SERVICE_NAME: "express-js",
                LUMIGO_DEBUG: true,
            }
        );
        const transactionId = await waitForTransactionId;
        expect(transactionId).toBeTruthy()
    });
});