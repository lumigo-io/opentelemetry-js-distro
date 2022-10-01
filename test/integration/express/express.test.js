const {test, describe} = require("../integrationTestUtils/setup");
const fs = require("fs");
const waitOn = require('wait-on')
require("jest-json");

const {waitForSpansInFile} = require("../integrationTestUtils/waiters");
const {callContainer} = require("../../helpers/helpers");
const {spawn} = require("child_process");
const kill = require("tree-kill");

const SPANS_DIR = `${__dirname}/spans`;
const EXEC_SERVER_FOLDER = "test/integration/express/app";
const TEST_TIMEOUT = 20000;
const WAIT_ON_TIMEOUT = 10000;
const INTEGRATION_NAME = `express`;

function getSpanByKind(spans, spanKindValue) {
    return spans.find((span) => span.kind === spanKindValue);
}

function isAllSpansInFile(filePath) {
    const allFileContents = fs.readFileSync(filePath, 'utf-8');
    const lines = allFileContents.split(/\r?\n/).filter((l) => l !== '');
    const spansWithoutWaitOnCall = lines.slice(2, lines.length)
    if (
        spansWithoutWaitOnCall.length === 3 &&
        spansWithoutWaitOnCall[0].startsWith('{"traceId"') &&
        spansWithoutWaitOnCall[1].startsWith('{"traceId"') &&
        spansWithoutWaitOnCall[2].startsWith('{"traceId"')
    ) {
        return spansWithoutWaitOnCall
    }
}

function getAppPort(data, app, resolve, reject) {
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
                    getAppPort(data, app, resolve, reject);
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
                            console.info('Got a response from server');
                            await callContainer(port, 'invoke-requests', 'get', {
                                a: '1',
                            });
                            let spans = await waitForSpansInFile(exporterFile, isAllSpansInFile);
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
                resource: {
                    attributes: {
                        'service.name': 'express',
                        'telemetry.sdk.language': 'nodejs',
                        'telemetry.sdk.name': 'opentelemetry',
                        'telemetry.sdk.version': '1.1.1',
                        framework: 'express',
                        'process.environ': expect.jsonMatching(
                            expect.objectContaining({
                                "OTEL_SERVICE_NAME": "express",
                                "LUMIGO_TRACER_TOKEN": "t_123321",
                            })),
                        'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
                        'process.pid': expect.any(Number),
                        'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
                        'process.runtime.name': 'nodejs',
                        'process.executable.name': 'node',
                    },
                },
                attributes: {
                    'http.method': 'GET',
                    'http.target': '/invoke-requests',
                    'http.flavor': '1.1',
                    'http.host': expect.stringMatching(/localhost:\d+/),
                    'http.scheme': 'http',
                    'net.peer.ip': '::ffff:127.0.0.1',
                    'http.request.query': '{}',
                    'http.request.headers': expect.stringMatching(/\{.*\}/),
                    'http.response.headers': expect.stringMatching(/\{.*\}/),
                    'http.response.body': expect.jsonMatching(["animal", "career", "celebrity", "dev", "explicit", "fashion", "food", "history", "money", "movie", "music", "political", "religion", "science", "sport", "travel"]),
                    'http.request.body': '{}',
                    'http.route': '/invoke-requests',
                    'express.route.full': '/invoke-requests',
                    'express.route.configured': '/invoke-requests',
                    'express.route.params': '{}',
                    'http.status_code': 200,
                },
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
                attributes: {
                    'http.url': expect.stringMatching(/http:\/\/localhost:\d+\/invoke-requests/),
                    'http.host': expect.stringMatching(/localhost:\d+/),
                    'net.host.name': 'localhost',
                    'http.method': 'GET',
                    'http.target': '/invoke-requests',
                    'http.user_agent': 'axios/0.21.4',
                    'http.flavor': '1.1',
                    'net.transport': 'ip_tcp',
                    'net.host.ip': '::ffff:127.0.0.1',
                    'net.host.port': expect.any(Number),
                    'net.peer.ip': '::ffff:127.0.0.1',
                    'net.peer.port': expect.any(Number),
                    'http.status_code': 200,
                    'http.status_text': 'OK',
                    'http.route': '/invoke-requests',
                },
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
                attributes: {
                    'http.url': 'https://api.chucknorris.io/jokes/categories',
                    'http.method': 'GET',
                    'http.target': '/jokes/categories',
                    'net.peer.name': 'api.chucknorris.io',
                    'http.request.body': '""',
                    'net.peer.ip': expect.stringMatching(
                        /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$)){4}\b/
                    ),
                    'net.peer.port': 443,
                    'http.host': 'api.chucknorris.io:443',
                    'http.status_code': 200,
                    'http.status_text': 'OK',
                    'http.flavor': '1.1',
                    'http.request.headers': expect.stringMatching(/\{.*\}/),
                    'http.response.headers': expect.stringMatching(/\{.*\}/),
                    'http.response.body': expect.stringMatching(
                        /\["animal","career","celebrity","dev","explicit","fashion","food","history","money","movie","music","political","religion","science","sport","travel"\]/
                    ),
                },
                status: {
                    code: 0,
                },
                events: [],
            });
        }
    );


});
