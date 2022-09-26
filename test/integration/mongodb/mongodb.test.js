require( 'console-stamp' )( console );
const {info, error} = require("console")
const {test, describe} = require("../integrationTestUtils/setup");
const fs = require("fs");
const waitOn = require('wait-on')
require("jest-json");

const {waitForSpansInFile} = require("../integrationTestUtils/waiters");
const {callContainer} = require("../../helpers/helpers");
const {spawn} = require("child_process");
const kill = require("tree-kill");

const SPANS_DIR = `${__dirname}/spans`;
const EXEC_SERVER_FOLDER = "test/integration/mongodb/app";
const TEST_TIMEOUT = 300000;
const WAIT_ON_TIMEOUT = 30000;
const APP_PORT = 8080;
const INTEGRATION_NAME = `mongodb`;

function getSpanByName(spans, spanName) {
    return spans.find((span) => span.name === spanName);
}

function isAllSpansInFile(filePath) {
    const allFileContents = fs.readFileSync(filePath, 'utf-8');
    const lines = allFileContents.split(/\r?\n/).filter((l) => l !== '');
    if (
        lines.length > 2 &&
        lines[0].startsWith('{"traceId"') &&
        lines[1].startsWith('{"traceId"') &&
        lines.filter((line) => line.includes('"name":"mongodb') && !line.includes("mongodb.isMaster")).length === 5
    ) {
        return lines
    }
}

describe({
    name: `Integration compatibility tests for all supported versions of ${INTEGRATION_NAME}`,
    itParamConfig: {dependencyPath: `${__dirname}/app/node_modules/${INTEGRATION_NAME}`}
}, function () {
    let app = undefined;
    let spans;

    beforeAll(() => {
        if (!fs.existsSync(SPANS_DIR)) {
            fs.mkdirSync(SPANS_DIR);
        }
    });

    afterEach(async () => {
        info("afterEach, stop child process")
        if (app) {
            await callContainer(APP_PORT, 'stop-mongodb', 'get');
            kill(app.pid);
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
                info('spawn data stderr: ', data.toString());
            });
            app.on('error', (error) => {
                error('spawn stderr: ', error);
            });

            const waited = new Promise((resolve, reject) => {
                waitOn(
                    {
                        resources: [`http-get://localhost:${APP_PORT}`],
                        delay: 10000,
                        timeout: WAIT_ON_TIMEOUT,
                        simultaneous: 1,
                        log: true, //TODO: SHANI -remove
                        verbose: true, //TODO: SHANI -remove
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
                            info('Got a response from server');
                            await callContainer(APP_PORT, 'test-mongodb', 'get');
                            let spans = await waitForSpansInFile(exporterFile, isAllSpansInFile);
                            resolve(spans.map((text) => JSON.parse(text)))
                        }
                    }
                );
            });
            try {
                spans = await waited
            } catch (e) {
                error(e)
                throw e;
            }
            expect(spans.filter(span => span.name.includes("mongodb") && !span.name.includes("mongodb.isMaster"))).toHaveLength(5);
            const insertSpan = getSpanByName(spans, "mongodb.insert");
            const findSpan = getSpanByName(spans, "mongodb.find");
            const updateSpan = getSpanByName(spans, "mongodb.update");
            const removeSpan = getSpanByName(spans, "mongodb.remove");
            const indexSpan = getSpanByName(spans, "mongodb.createIndexes");

            let resourceAttributes = {
                "service.name": "mongodb",
                "telemetry.sdk.language": "nodejs",
                "telemetry.sdk.name": "opentelemetry",
                "telemetry.sdk.version": "1.1.1",
                "framework": "node",
                'process.environ': expect.jsonMatching(
                    expect.objectContaining({
                        "OTEL_SERVICE_NAME": "mongodb",
                        "LUMIGO_TRACER_TOKEN": "t_123321",
                    })),
                'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
                'process.pid': expect.any(Number),
                "process.executable.name": "node",
                'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
                "process.runtime.name": "nodejs",
                "process.runtime.description": "Node.js",
            };

            expect(insertSpan).toMatchObject({
                traceId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: "mongodb.insert",
                kind: 2,
                resource: {
                    attributes: resourceAttributes
                },
                attributes: {
                    'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                    'net.host.port': expect.any(String),
                    'db.system': "mongodb",
                    'db.name': "myProject",
                    'db.mongodb.collection': "insertOne",
                    'db.statement': expect.stringMatching(/"a":1,"_id":/),
                },
                status: {
                    code: 0,
                },
                events: [],
            });
            expect(findSpan).toMatchObject({
                traceId: expect.any(String),
                parentId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'mongodb.find',
                kind: 2,
                resource: {
                    attributes: resourceAttributes
                },
                attributes: {
                    'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                    'net.host.port': expect.any(String),
                    'db.system': "mongodb",
                    'db.name': "myProject",
                    'db.mongodb.collection': "insertOne",
                    'db.statement': "{\"a\":1}"
                },
                status: {
                    code: 0,
                },
                events: [],
            });
            expect(updateSpan).toMatchObject({
                traceId: expect.any(String),
                parentId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'mongodb.update',
                kind: 2,
                resource: {
                    attributes: resourceAttributes
                },
                attributes: {
                    'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                    'net.host.port': expect.any(String),
                    'db.system': "mongodb",
                    'db.name': "myProject",
                    'db.mongodb.collection': "insertOne",
                    'db.statement': "{\"a\":1}"
                },
                status: {
                    code: 0,
                },
                events: [],
            });
            expect(removeSpan).toMatchObject({
                traceId: expect.any(String),
                parentId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'mongodb.remove',
                kind: 2,
                resource: {
                    attributes: resourceAttributes
                },
                attributes: {
                    'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                    'net.host.port': expect.any(String),
                    'db.system': "mongodb",
                    'db.name': "myProject",
                    'db.mongodb.collection': "insertOne",
                    'db.statement': "{\"b\":1}"
                },
                status: {
                    code: 0,
                },
                events: [],
            });
            expect(indexSpan).toMatchObject({
                traceId: expect.any(String),
                parentId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'mongodb.createIndexes',
                kind: 2,
                resource: {
                    attributes: resourceAttributes
                },
                attributes: {
                    'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                    'net.host.port': expect.any(String),
                    'db.system': "mongodb",
                    'db.name': "myProject",
                    'db.mongodb.collection': "$cmd",
                    'db.statement': expect.stringMatching(/"createIndexes":"insertOne","indexes":\[{"name":"a_1","key":/),
                },
                status: {
                    code: 0,
                },
                events: [],
            });
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
                info('spawn data stderr: ', data.toString());
            });
            app.on('error', (error) => {
                error('spawn stderr: ', error);
            });

            const waited = new Promise((resolve, reject) => {
                waitOn(
                    {
                        resources: [`http-get://localhost:${APP_PORT}`],
                        delay: 10000,
                        timeout: WAIT_ON_TIMEOUT,
                        simultaneous: 1,
                        log: true, //TODO: SHANI -remove
                        verbose: true, //TODO: SHANI -remove
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
                            info('Got a response from server');
                            await callContainer(APP_PORT, 'test-mongodb', 'get');
                            let spans = await waitForSpansInFile(exporterFile, isAllSpansInFile);
                            resolve(spans.map((text) => JSON.parse(text)))
                        }
                    }
                );
            });
            try {
                spans = await waited
            } catch (e) {
                error(e)
                throw e;
            }
            expect(spans.filter(span => span.name.includes("mongodb") && !span.name.includes("mongodb.isMaster"))).toHaveLength(5);
            const insertSpan = getSpanByName(spans, "mongodb.insert");
            const findSpan = getSpanByName(spans, "mongodb.find");
            const updateSpan = getSpanByName(spans, "mongodb.update");
            const removeSpan = getSpanByName(spans, "mongodb.delete");
            const indexSpan = getSpanByName(spans, "mongodb.createIndexes");

            let resourceAttributes = {
                "service.name": "mongodb",
                "telemetry.sdk.language": "nodejs",
                "telemetry.sdk.name": "opentelemetry",
                "telemetry.sdk.version": "1.1.1",
                "framework": "node",
                'process.environ': expect.jsonMatching(
                    expect.objectContaining({
                        "OTEL_SERVICE_NAME": "mongodb",
                        "LUMIGO_TRACER_TOKEN": "t_123321",
                    })),
                'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
                'process.pid': expect.any(Number),
                "process.executable.name": "node",
                'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
                "process.runtime.name": "nodejs",
                "process.runtime.description": "Node.js",
            };

            expect(insertSpan).toMatchObject({
                traceId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: "mongodb.insert",
                kind: 2,
                resource: {
                    attributes: resourceAttributes
                },
                attributes: {
                    'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                    'net.host.port': expect.any(String),
                    'db.system': "mongodb",
                    'db.name': "myProject",
                    'db.mongodb.collection': "insertOne",
                    'db.statement': expect.stringMatching(/"a":1,"_id":/),
                },
                status: {
                    code: 0,
                },
                events: [],
            });
            expect(findSpan).toMatchObject({
                traceId: expect.any(String),
                parentId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'mongodb.find',
                kind: 2,
                resource: {
                    attributes: resourceAttributes
                },
                attributes: {
                    'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                    'net.host.port': expect.any(String),
                    'db.system': "mongodb",
                    'db.name': "myProject",
                    'db.mongodb.collection': "insertOne",
                    'db.statement': "{\"find\":\"insertOne\",\"filter\":{\"a\":1}}"
                },
                status: {
                    code: 0,
                },
                events: [],
            });
            expect(updateSpan).toMatchObject({
                traceId: expect.any(String),
                parentId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'mongodb.update',
                kind: 2,
                resource: {
                    attributes: resourceAttributes
                },
                attributes: {
                    'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                    'net.host.port': expect.any(String),
                    'db.system': "mongodb",
                    'db.name': "myProject",
                    'db.mongodb.collection': "insertOne",
                    'db.statement': "{\"update\":\"insertOne\",\"updates\":[{\"q\":{\"a\":1},\"u\":{\"$set\":{\"b\":1}}}],\"ordered\":true}"
                },
                status: {
                    code: 0,
                },
                events: [],
            });
            expect(removeSpan).toMatchObject({
                traceId: expect.any(String),
                parentId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'mongodb.delete',
                kind: 2,
                resource: {
                    attributes: resourceAttributes
                },
                attributes: {
                    'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                    'net.host.port': expect.any(String),
                    'db.system': "mongodb",
                    'db.name': "myProject",
                    'db.mongodb.collection': "insertOne",
                    'db.statement': "{\"delete\":\"insertOne\",\"deletes\":[{\"q\":{\"b\":1},\"limit\":0}],\"ordered\":true}"
                },
                status: {
                    code: 0,
                },
                events: [],
            });
            expect(indexSpan).toMatchObject({
                traceId: expect.any(String),
                parentId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'mongodb.createIndexes',
                kind: 2,
                resource: {
                    attributes: resourceAttributes
                },
                attributes: {
                    'net.host.name': expect.stringMatching(/^(127\.[\d.]+|[0:]+1|localhost)$/),
                    'net.host.port': expect.any(String),
                    'db.system': "mongodb",
                    'db.name': "myProject",
                    'db.mongodb.collection': "$cmd",
                    'db.statement': expect.stringMatching(/"createIndexes":"insertOne","indexes":\[{"name":"a_1","key":/),
                },
                status: {
                    code: 0,
                },
                events: [],
            });
        }
    );
});
