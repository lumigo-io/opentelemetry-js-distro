const {test, describe} = require("../integrationTestUtils/setup");
const fs = require("fs");
const waitOn = require('wait-on')
require("jest-json");

const {waitForSpansInFile} = require("../integrationTestUtils/waiters");
const {callContainer} = require("../../helpers/helpers");
const {spawn} = require("child_process");
const kill = require("tree-kill");
const {getInstrumentationSpansFromFile, getSpanByName, getFilteredSpans, getExpectedResourceAttributes, getExpectedSpan,
    getExpectedSpanWithParent
} = require("./mongodbTestUtils");

const SPANS_DIR = `${__dirname}/spans`;
const EXEC_SERVER_FOLDER = "test/integration/mongodb/app";
const TEST_TIMEOUT = 300000;
const WAIT_ON_TIMEOUT = 80000;
const APP_PORT = 8080;
const INTEGRATION_NAME = `mongodb`;
const INSERT_CMD = "mongodb.insert";
const FIND_CMD = 'mongodb.find';
const UPDATE_CMD = 'mongodb.update';
const REMOVE_CMD = 'mongodb.remove';
const CREATE_INDEX_CMD = 'mongodb.createIndexes';
const DELETE_CMD = "mongodb.delete";
const expectedIndexStatement = expect.stringMatching(/"createIndexes":"insertOne","indexes":\[{"name":"a_1","key"/);


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
        if (app) {
            await callContainer(APP_PORT, 'stop-mongodb', 'get');
            kill(app.pid);
            console.info("afterEach, stop child process")
        }
    });

    test(
        `basic ${INTEGRATION_NAME} V3 test`,
        {
            itParamConfig: {
                integration: INTEGRATION_NAME,
                spansFilePath: SPANS_DIR,
                supportedVersion: 3,
                timeout: TEST_TIMEOUT
            }
        }, async (exporterFile) => {
            // start server
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
                console.error('spawn stderr: ', error);
            });

            const waited = new Promise((resolve, reject) => {
                waitOn(
                    {
                        resources: [`http-get://localhost:${APP_PORT}`],
                        delay: 20000,
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
                            await callContainer(APP_PORT, 'test-mongodb', 'get');
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

            expect(getFilteredSpans(spans)).toHaveLength(5);
            const insertSpan = getSpanByName(spans, INSERT_CMD);
            const findSpan = getSpanByName(spans, FIND_CMD);
            const updateSpan = getSpanByName(spans, UPDATE_CMD);
            const removeSpan = getSpanByName(spans, REMOVE_CMD);
            const indexSpan = getSpanByName(spans, CREATE_INDEX_CMD);

            let resourceAttributes = getExpectedResourceAttributes();

            expect(insertSpan).toMatchObject(getExpectedSpan(INSERT_CMD, resourceAttributes, expect.stringMatching(/"a":1,"_id":/)));
            expect(findSpan).toMatchObject(getExpectedSpanWithParent(FIND_CMD, resourceAttributes, "{\"a\":1}"));
            expect(updateSpan).toMatchObject(getExpectedSpanWithParent(UPDATE_CMD, resourceAttributes, "{\"a\":1}"));
            expect(removeSpan).toMatchObject(getExpectedSpanWithParent(REMOVE_CMD, resourceAttributes, "{\"b\":1}"), "$cmd");
        }
    );

    test(
        `basic ${INTEGRATION_NAME} V4 test`,
        {
            itParamConfig: {
                integration: INTEGRATION_NAME,
                spansFilePath: SPANS_DIR,
                supportedVersion: 4,
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
                console.error('spawn stderr: ', error);
            });

            const waited = new Promise((resolve, reject) => {
                waitOn(
                    {
                        resources: [`http-get://localhost:${APP_PORT}`],
                        delay: 10000,
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
                            await callContainer(APP_PORT, 'test-mongodb', 'get');
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

            expect(getFilteredSpans(spans)).toHaveLength(5);
            const insertSpan = getSpanByName(spans, INSERT_CMD);
            const findSpan = getSpanByName(spans, FIND_CMD);
            const updateSpan = getSpanByName(spans, UPDATE_CMD);
            const removeSpan = getSpanByName(spans, DELETE_CMD);
            const indexSpan = getSpanByName(spans, CREATE_INDEX_CMD);

            let resourceAttributes = getExpectedResourceAttributes();

            expect(insertSpan).toMatchObject(getExpectedSpan(INSERT_CMD, resourceAttributes, expect.stringMatching(/"a":1,"_id":/)));
            expect(findSpan).toMatchObject(getExpectedSpanWithParent(FIND_CMD, resourceAttributes, "{\"find\":\"insertOne\",\"filter\":{\"a\":1}}"));
            const expectedUpdateStatement = "{\"update\":\"insertOne\",\"updates\":[{\"q\":{\"a\":1},\"u\":{\"$set\":{\"b\":1}}}],\"ordered\":true}";
            expect(updateSpan).toMatchObject(getExpectedSpanWithParent(UPDATE_CMD, resourceAttributes, expectedUpdateStatement));
            const expectedDeleteStatement = "{\"delete\":\"insertOne\",\"deletes\":[{\"q\":{\"b\":1},\"limit\":0}],\"ordered\":true}";
            expect(removeSpan).toMatchObject(getExpectedSpanWithParent(DELETE_CMD, resourceAttributes, expectedDeleteStatement));
            expect(indexSpan).toMatchObject(getExpectedSpanWithParent(CREATE_INDEX_CMD, resourceAttributes, expectedIndexStatement, "$cmd"));
        }
    );
});
