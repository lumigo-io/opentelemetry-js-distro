const {test, describe} = require("../setup");
const fs = require("fs");
const waitOn = require('wait-on')
require("jest-json");

const {waitForSpansInFile} = require("../../testUtils/waiters");
const {spawn} = require("child_process");
const kill = require("tree-kill");
const {getInstrumentationSpansFromFile, expectedResourceAttributes, expectedServerAttributes,
    internalSpanAttributes, expectedClientAttributes
} = require("./expressTestUtils");
const {getSpanByKind} = require("../../testUtils/spanUtils");
const {callContainer, getAppPort} = require("../../testUtils/utils");

const SPANS_DIR = `${__dirname}/spans`;
const EXEC_SERVER_FOLDER = "test/integration/express/app";
const TEST_TIMEOUT = 20000;
const WAIT_ON_TIMEOUT = 10000;
const INTEGRATION_NAME = `express`;


describe({
    name: `Integration compatibility tests for all supported versions of ${INTEGRATION_NAME}`,
    describeParamConfig: {dependencyPath: `${__dirname}/app/node_modules/${INTEGRATION_NAME}`}
}, function () {
    let app = undefined;
    let spans;

    process.on('SIGINT', (app) => {
        if (app){
            app.kill('SIGINT');
        }
        process.exit();
    }); // catch ctrl-c

    process.on('SIGTERM', (app) => {
        if (app){
            app.kill('SIGINT');
        }
        process.exit();
    }); // catch kill

    beforeAll(() => {
        if (!fs.existsSync(SPANS_DIR)) {
            fs.mkdirSync(SPANS_DIR);
        }
    });

    afterEach(async () => {
        console.info("afterEach, stop child process")
        if (app) {
            kill(app.pid);
        }
    });

    test(
        "basic express test",
        {
            itParamConfig: {
                integration: INTEGRATION_NAME,
                spansFilePath: SPANS_DIR,
                supportedVersion: null,
                timeout: TEST_TIMEOUT
            }
        }, async (exporterFile) => {
            // //start server
            app = spawn(`cd ${EXEC_SERVER_FOLDER} && npm`, ["run", `start:${INTEGRATION_NAME}:injected`], {
                env: {
                    ...process.env, ...{
                        LUMIGO_TRACER_TOKEN: 't_123321',
                        LUMIGO_DEBUG_SPANDUMP: exporterFile,
                        OTEL_SERVICE_NAME: INTEGRATION_NAME,
                        LUMIGO_DEBUG: true,
                        OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: "4096"
                    }
                },
                shell: true
            });

            app.stderr.on('data', (data) => {
                console.info('spawn data stderr: ', data.toString());
            });
            app.on('error', (error) => {
                error('spawn stderr: ', error);
            });

            const port = await new Promise((resolve, reject) => {
                app.stdout.on('data', (data) => {
                    getAppPort(data, resolve, reject);
                });
            });
            console.info(`port: ${port}`)

            const waited = new Promise((resolve, reject) => {
                waitOn(
                    {
                        resources: [`http-get://localhost:${port}`],
                        delay: 5000,
                        timeout: WAIT_ON_TIMEOUT,
                        simultaneous: 1,
                        log: true,
                        verbose: true,
                        validateStatus: function (status) {
                            console.debug("server status:", status);
                            return status >= 200 && status < 300; // default if not provided
                        },
                    },
                    async function (err) {
                        if (err) {
                            console.error("inside waitOn", err);
                            return reject(err)
                        } else {
                            console.info('Got a response from server');
                            await callContainer(port, 'invoke-requests', 'get', {
                                a: '1',
                            });
                            let spans = await waitForSpansInFile(exporterFile, getInstrumentationSpansFromFile);
                            resolve(spans.map((text) => JSON.parse(text)))
                        }
                    }
                );
            });
            try {
                spans = await waited
            } catch (e) {
                console.error(e)
                throw e;
            }

            expect(spans).toHaveLength(3);
            const serverSpan = getSpanByKind(spans,0);
            const internalSpan = getSpanByKind(spans,1);
            const clientSpan = getSpanByKind(spans,2);
            expect(
                serverSpan.traceId === internalSpan.traceId && serverSpan.traceId === clientSpan.traceId
            ).toBeTruthy();

            expect(serverSpan).toMatchObject({
                traceId: expect.any(String),
                parentId: expect.any(String),
                name: 'GET /invoke-requests',
                id: expect.any(String),
                kind: 0,
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                resource: expectedResourceAttributes,
                attributes: expectedServerAttributes,
                status: {
                    code: 1,
                },
                events: [],
            });

            expect(internalSpan).toMatchObject({
                traceId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'HTTP GET',
                kind: 1,
                attributes: internalSpanAttributes,
                status: {
                    code: 0,
                },
                events: [],
            });

            expect(clientSpan).toMatchObject({
                traceId: expect.any(String),
                parentId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'HTTPS GET',
                kind: 2,
                attributes: expectedClientAttributes,
                status: {
                    code: 0,
                },
                events: [],
            });
        }
    );
});
