const fs = require("fs");
const waitOn = require('wait-on')
require("jest-json");

const {waitForSpansInFile, sleep} = require("../../testUtils/waiters");
const kill = require("tree-kill");
const {
    getInstrumentationSpansFromFile, expectedResourceAttributes,
    internalSpanAttributes, expectedClientAttributes
} = require("./httpTestUtils");
const {getSpanByKind} = require("../../testUtils/spanUtils");
const {getAppPort, callContainer, getStartedApp} = require("../../testUtils/utils");

const SPANS_DIR = `${__dirname}/spans`;
const TEST_TIMEOUT = 20_000;
const WAIT_ON_TIMEOUT = 20_000;
const COMPONENT_NAME = `http`;
const EXEC_SERVER_FOLDER = `test/component/${COMPONENT_NAME}/app`;


async function getPort(app) {
    const port = await new Promise((resolve, reject) => {
        app.stdout.on('data', (data) => {
            getAppPort(data, resolve, reject);
        });
    });
    console.info(`port: ${port}`)
    return port;
}

describe(`Component compatibility tests for HTTP`, function () {
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
            kill(app.pid, 'SIGHUP');
            await sleep(100)
        }
    });

    test("basic http test", async () => {
        const fileExporterName = `${SPANS_DIR}/spans-${COMPONENT_NAME}-basic.json`;

        // start server
        app = getStartedApp(EXEC_SERVER_FOLDER, COMPONENT_NAME, fileExporterName, {LUMIGO_ENDPOINT: "https://walle-edge-app-us-west-2.walle.golumigo.com",
            LUMIGO_TRACER_TOKEN: 't_123321'});
        const port = await getPort(app);

        const waited = new Promise((resolve, reject) => {
            waitOn(
                {
                    resources: [`http-get://localhost:${port}`],
                    delay: 5000,
                    timeout: WAIT_ON_TIMEOUT,
                    simultaneous: 1,
                    log: true,
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
                        await callContainer(port, 'test1', 'get');
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
            attributes: {...internalSpanAttributes, "lumigo.execution_tags.foo": ["bar", "baz"]},
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
    }, TEST_TIMEOUT);

    test("http test - OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT is set", async () => {
        const fileExporterName = `${SPANS_DIR}/spans-${COMPONENT_NAME}-span-attr.json`;

        // start server
        app = getStartedApp(EXEC_SERVER_FOLDER, COMPONENT_NAME, fileExporterName, {OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: "1"});
        const port = await getPort(app);

        const waited = new Promise((resolve, reject) => {
            waitOn(
                {
                    resources: [`http-get://localhost:${port}`],
                    delay: 5000,
                    timeout: WAIT_ON_TIMEOUT,
                    simultaneous: 1,
                    log: true,
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
                        await callContainer(port, 'test2', 'get');
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
        expect(Object.values(JSON.parse(internalSpan.resource.attributes["process.environ"])).join("").length).toBeLessThanOrEqual(5);

        expect(internalSpan.attributes).toMatchObject(
            {
                'http.host': "l",
                'net.host.name': 'l',
                'http.method': 'G',
                'http.user_agent': 'a',
                'http.flavor': '1',
                'net.transport': 'i',
                "net.host.ip": expect.any(String),
                'net.host.port': expect.any(Number),
                "net.peer.ip": expect.any(String),
                'net.peer.port': expect.any(Number),
                'http.status_code': 200,
                'http.status_text': 'O',
                "http.url": "h",
                "lumigo.execution_tags.foo": "f",
                "lumigo.execution_tags.baz": true
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
    }, TEST_TIMEOUT);

    test("http test - OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT is set", async () => {
        const fileExporterName = `${SPANS_DIR}/spans-${COMPONENT_NAME}-otel-attr.json`;

        // start server
        app = getStartedApp(EXEC_SERVER_FOLDER, COMPONENT_NAME, fileExporterName, {OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT: "3"});
        const port = await getPort(app);

        const waited = new Promise((resolve, reject) => {
            waitOn(
                {
                    resources: [`http-get://localhost:${port}`],
                    delay: 5000,
                    timeout: WAIT_ON_TIMEOUT,
                    simultaneous: 1,
                    log: true,
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
                        await callContainer(port, 'large-response', 'get');
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
        expect(Object.values(JSON.parse(internalSpan.resource.attributes["process.environ"])).join("").length).toBeLessThanOrEqual(7);
        expect(internalSpan.attributes).toMatchObject(
            {
                'http.host': "loc",
                'net.host.name': 'loc',
                'http.method': 'GET',
                'http.user_agent': 'axi',
                'http.flavor': '1.1',
                'net.transport': 'ip_',
                "net.host.ip": expect.any(String),
                'net.host.port': expect.any(Number),
                "net.peer.ip": expect.any(String),
                'net.peer.port': expect.any(Number),
                'http.status_code': 200,
                'http.status_text': 'OK',
                "http.url": "htt",
                "lumigo.execution_tags.foo": "bar",
                "lumigo.execution_tags.date": 1234567
            }
        )
        expect(clientSpan.attributes).toMatchObject(
            {
                'http.url': 'htt',
                'http.method': 'GET',
                'http.target': '/se',
                'net.peer.name': 'uni',
                'http.request.body': '""',
                'net.peer.ip': expect.stringMatching(/\d+\./),
                'net.peer.port': 80,
                'http.host': 'uni',
                'http.status_code': 200,
                'http.status_text': 'OK',
                'http.flavor': '1.1',
                'http.request.headers': '{"a',
                'http.response.headers': '{"s',
                'http.response.body': '"[{',
            }
        )
    }, TEST_TIMEOUT);

    test("http test - no attributes length environment variable is set, default value is set", async () => {
        const fileExporterName = `${SPANS_DIR}/spans-${COMPONENT_NAME}-default.json`;

        // start server
        app = getStartedApp(EXEC_SERVER_FOLDER, COMPONENT_NAME, fileExporterName);
        const port = await getPort(app);

        const waited = new Promise((resolve, reject) => {
            waitOn(
                {
                    resources: [`http-get://localhost:${port}`],
                    delay: 5000,
                    timeout: WAIT_ON_TIMEOUT,
                    simultaneous: 1,
                    log: true,
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
                        await callContainer(port, 'large-response', 'get');
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
                'http.host': `localhost:${port}`,
                'net.host.name': "localhost",
                'http.method': 'GET',
                'http.user_agent': "axios/0.21.4",
                'http.flavor': '1.1',
                'net.transport': "ip_tcp",
                "net.host.ip": expect.any(String),
                'net.host.port': expect.any(Number),
                "net.peer.ip": expect.any(String),
                'net.peer.port': expect.any(Number),
                'http.status_code': 200,
                'http.status_text': 'OK',
                "http.url": `http://localhost:${port}/large-response`,
                "lumigo.execution_tags.foo": "bar",
                "lumigo.execution_tags.date": 1234567
            }
        )
        const clientAttributes = clientSpan.attributes;
        expect(clientAttributes).toMatchObject(
            {
                'http.url': "http://universities.hipolabs.com/search?country=United+States",
                'http.method': 'GET',
                'http.target': "/search?country=United+States",
                'net.peer.name': "universities.hipolabs.com",
                'http.request.body': '""',
                'net.peer.ip': expect.stringMatching(
                    /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$))\b/
                ),
                'net.peer.port': 80,
                'http.host': "universities.hipolabs.com:80",
                'http.status_code': 200,
                'http.status_text': 'OK',
                'http.flavor': '1.1',
                'http.request.headers': expect.stringMatching(/{.*}/),
                'http.response.headers': expect.stringMatching(/{.*}/),
                'http.response.body': expect.any(String),
            }
        )
        expect(clientAttributes['http.response.body'].length).toEqual(2048)
    }, TEST_TIMEOUT);
       
});
