const fs = require("fs");
const waitOn = require('wait-on')
require("jest-json");

const {waitForSpansInFile} = require("../../testUtils/waiters");
const {callContainer} = require("../../helpers/helpers");
const {spawn} = require("child_process");
const kill = require("tree-kill");
const {
    getInstrumentationSpansFromFile, expectedResourceAttributes,
    internalSpanAttributes, expectedClientAttributes
} = require("./httpTestUtils");
const {getSpanByKind} = require("../../testUtils/spanUtils");

const SPANS_DIR = `${__dirname}/spans`;
const TEST_TIMEOUT = 20000;
const WAIT_ON_TIMEOUT = 15000;
const APP_PORT = 8000;
const COMPONENT_NAME = `http`;
const EXEC_SERVER_FOLDER = `test/component/${COMPONENT_NAME}/app`;

function getStartedApp(fileExporterName, env_vars ={}) {
    let app = spawn(`cd ${EXEC_SERVER_FOLDER} && npm`, ["run", `start:${COMPONENT_NAME}:injected`], {
        env: {
            ...process.env, ...{
                LUMIGO_TRACER_TOKEN: 't_123321',
                LUMIGO_DEBUG_SPANDUMP: fileExporterName,
                OTEL_SERVICE_NAME: COMPONENT_NAME,
                LUMIGO_DEBUG: true,
                ...env_vars
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
    return app;
}

describe(`Component compatibility tests for ${COMPONENT_NAME}`, function () {
    let app = undefined;
    let spans;

    process.on('SIGINT', (app) => {
        if (app) {
            app.kill('SIGINT');
        }
        process.exit();
    }); // catch ctrl-c

    process.on('SIGTERM', (app) => {
        if (app) {
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

    test("basic http test", async () => {
            const fileExporterName = `${SPANS_DIR}/spans-${COMPONENT_NAME}-basic.json`;

            // start server
            app = getStartedApp(fileExporterName);

            const waited = new Promise((resolve, reject) => {
                waitOn(
                    {
                        resources: [`http-get://localhost:${APP_PORT}`],
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
                            await callContainer(APP_PORT, 'test', 'get');
                            let spans = await waitForSpansInFile(fileExporterName, getInstrumentationSpansFromFile);
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

            expect(spans).toHaveLength(2);
            const internalSpan = getSpanByKind(spans, 1);
            const clientSpan = getSpanByKind(spans, 2);

            expect(internalSpan).toMatchObject({
                traceId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'HTTP GET',
                kind: 1,
                resource: expectedResourceAttributes,
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
        , TEST_TIMEOUT);

    test("http test - OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT is set", async () => {
            const fileExporterName = `${SPANS_DIR}/spans-${COMPONENT_NAME}-span-attr.json`;

            // start server
            app = getStartedApp(fileExporterName, {OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: "1"});

            const waited = new Promise((resolve, reject) => {
                waitOn(
                    {
                        resources: [`http-get://localhost:${APP_PORT}`],
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
                            await callContainer(APP_PORT, 'v2/test', 'get');
                            let spans = await waitForSpansInFile(fileExporterName, getInstrumentationSpansFromFile);
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

            expect(spans).toHaveLength(2);
            const internalSpan = getSpanByKind(spans, 1);
            const clientSpan = getSpanByKind(spans, 2);
            expect(Object.values(JSON.parse(internalSpan.resource.attributes["process.environ"])).join("").length).toBeLessThanOrEqual(1);

            expect(internalSpan.attributes).toMatchObject(
                {
                    'http.host': "l",
                    'net.host.name': 'l',
                    'http.method': 'G',
                    'http.user_agent': 'a',
                    'http.flavor': '1',
                    'net.transport': 'i',
                    "net.host.ip": "1",
                    'net.host.port': expect.any(Number),
                    "net.peer.ip": "1",
                    'net.peer.port': expect.any(Number),
                    'http.status_code': 200,
                    'http.status_text': 'O',
                    "http.url": "h",
                }
            )
            expect(clientSpan.attributes).toMatchObject(
                {
                    'http.url': 'h',
                    'http.method': 'G',
                    'http.target': '/',
                    'net.peer.name': 'd',
                    'http.request.body': '"',
                    'net.peer.ip': "1",
                    'net.peer.port': 443,
                    'http.host': 'd',
                    'http.status_code': 200,
                    'http.status_text': 'O',
                    'http.flavor': '1',
                    'http.request.headers': "{",
                    'http.response.headers': "{",
                    'http.response.body': '"',
                }
            )
        }
        , TEST_TIMEOUT);

    test("http test - OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT is set", async () => {
            const fileExporterName = `${SPANS_DIR}/spans-${COMPONENT_NAME}-otel-attr.json`;

            // start server
            app = getStartedApp(fileExporterName, {OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT: "3"});

            const waited = new Promise((resolve, reject) => {
                waitOn(
                    {
                        resources: [`http-get://localhost:${APP_PORT}`],
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
                            await callContainer(APP_PORT, 'large-response', 'get');
                            let spans = await waitForSpansInFile(fileExporterName, getInstrumentationSpansFromFile);
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

            expect(spans).toHaveLength(2);
            const internalSpan = getSpanByKind(spans, 1);
            const clientSpan = getSpanByKind(spans, 2);
            expect(Object.values(JSON.parse(internalSpan.resource.attributes["process.environ"])).join("").length).toBeLessThanOrEqual(3);
            expect(internalSpan.attributes).toMatchObject(
                {
                    'http.host': "loc",
                    'net.host.name': 'loc',
                    'http.method': 'GET',
                    'http.user_agent': 'axi',
                    'http.flavor': '1.1',
                    'net.transport': 'ip_',
                    "net.host.ip": "127",
                    'net.host.port': expect.any(Number),
                    "net.peer.ip": "127",
                    'net.peer.port': expect.any(Number),
                    'http.status_code': 200,
                    'http.status_text': 'OK',
                    "http.url": "htt",
                }
            )
            expect(clientSpan.attributes).toMatchObject(
                {
                    'http.url': 'htt',
                    'http.method': 'GET',
                    'http.target': '/en',
                    'net.peer.name': 'api',
                    'http.request.body': '""',
                    'net.peer.ip': expect.stringMatching(
                        /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$))\b/
                    ),
                    'net.peer.port': 443,
                    'http.host': 'api',
                    'http.status_code': 200,
                    'http.status_text': 'OK',
                    'http.flavor': '1.1',
                    'http.request.headers': '{"a',
                    'http.response.headers': '{"a',
                    'http.response.body': '"{\\',
                }
            )
        }
        , TEST_TIMEOUT);

    test("http test - no attributes length environment variable is set, default value is set", async () => {
            const fileExporterName = `${SPANS_DIR}/spans-${COMPONENT_NAME}-default.json`;

            // start server
            app = getStartedApp(fileExporterName);

            const waited = new Promise((resolve, reject) => {
                waitOn(
                    {
                        resources: [`http-get://localhost:${APP_PORT}`],
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
                            await callContainer(APP_PORT, 'large-response', 'get');
                            let spans = await waitForSpansInFile(fileExporterName, getInstrumentationSpansFromFile);
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

            expect(spans).toHaveLength(2);
            const internalSpan = getSpanByKind(spans, 1);
            const clientSpan = getSpanByKind(spans, 2);
            expect(internalSpan.attributes).toMatchObject(
                {
                    'http.host': "localhost:8000",
                    'net.host.name': "localhost",
                    'http.method': 'GET',
                    'http.user_agent': "axios/0.21.4",
                    'http.flavor': '1.1',
                    'net.transport': "ip_tcp",
                    "net.host.ip": "127.0.0.1",
                    'net.host.port': expect.any(Number),
                    "net.peer.ip": "127.0.0.1",
                    'net.peer.port': expect.any(Number),
                    'http.status_code': 200,
                    'http.status_text': 'OK',
                    "http.url": "http://localhost:8000/large-response",
                }
            )
            const clientAttributes = clientSpan.attributes;
            expect(clientAttributes).toMatchObject(
                {
                    'http.url': "https://api.publicapis.org/entries",
                    'http.method': 'GET',
                    'http.target': "/entries",
                    'net.peer.name': "api.publicapis.org",
                    'http.request.body': '""',
                    'net.peer.ip': expect.stringMatching(
                        /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$))\b/
                    ),
                    'net.peer.port': 443,
                    'http.host': "api.publicapis.org:443",
                    'http.status_code': 200,
                    'http.status_text': 'OK',
                    'http.flavor': '1.1',
                    'http.request.headers': expect.stringMatching(/{.*}/),
                    'http.response.headers': expect.stringMatching(/{.*}/),
                    'http.response.body': expect.any(String),
                }
            )
            expect(clientAttributes['http.response.body'].length).toEqual(2048)
        }
        , TEST_TIMEOUT);
});
