const fs = require('fs');
const waitOn = require('wait-on');
require('jest-json');

const kill = require('tree-kill');
const {
    getSpansFromSpanDump, expectedResourceAttributes,
    internalSpanAttributes, expectedClientAttributes
} = require('./httpTestUtils');
const { getSpanByKind } = require('../../testUtils/spanUtils');
const { startTestApp } = require('../../testUtils/utils');

const SPANS_DIR = `${__dirname}/spans`;
const TEST_TIMEOUT = 20_000;
const WAIT_ON_TIMEOUT = 15_000;
const COMPONENT_NAME = 'http';
const EXEC_SERVER_FOLDER = `test/component/${COMPONENT_NAME}/app`;

const waitForExpect = require('wait-for-expect');

describe(`Component compatibility tests for HTTP`, function () {
    let app = undefined;

    beforeAll(() => {
        if (!fs.existsSync(SPANS_DIR)) {
            fs.mkdirSync(SPANS_DIR);
        }
    });

    afterEach(async () => {
        console.info('afterEach, stop child process')
        if (app) {
            kill(app.pid, 'SIGHUP');
            // Wait 100 ms to give the app time to shutdown
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    });

    test('basic http test', async () => {
        const spanDumpLog = `${SPANS_DIR}/spans-${COMPONENT_NAME}-basic.json`;

        const { app: testApp, port } = await startTestApp(EXEC_SERVER_FOLDER, COMPONENT_NAME, spanDumpLog, {
            LUMIGO_ENDPOINT: 'https://walle-edge-app-us-west-2.walle.golumigo.com',
            LUMIGO_TRACER_TOKEN: 't_123321'
        });
        app = testApp;

        await issueHttpRequest(
            `http-get://localhost:${port}/test1`,
            spanDumpLog,
        );

        await waitForExpect(async () => {
            const spans = getSpansFromSpanDump(spanDumpLog);

            console.error(`Spans: ${spans}`);

            expect(spans).toHaveLength(2);

            const serverSpan = getSpanByKind(spans, 1);
            expect(serverSpan).toMatchObject({
                traceId: expect.any(String),
                id: expect.any(String),
                timestamp: expect.any(Number),
                duration: expect.any(Number),
                name: 'HTTP GET',
                kind: 1,
                resource: expectedResourceAttributes,
                attributes: {...internalSpanAttributes, 'lumigo.execution_tags.foo': ['bar', 'baz']},
                status: {
                    code: 0,
                },
                events: [],
            });
            console.error('Server span matches');

            const clientSpan = getSpanByKind(spans, 2);
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
            console.error('Client span matches');
        }, TEST_TIMEOUT);
    }, TEST_TIMEOUT);

    test('http test - OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT is set', async () => {
        const spanDumpLog = `${SPANS_DIR}/spans-${COMPONENT_NAME}-span-attr.json`;

        const { app: testApp, port } = await startTestApp(EXEC_SERVER_FOLDER, COMPONENT_NAME, spanDumpLog, {OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '1'});
        app = testApp;

        await issueHttpRequest(
            `http-get://localhost:${port}/test2`,
            spanDumpLog,
        );

        await waitForExpect(async () => {
            const spans = getSpansFromSpanDump(spanDumpLog);

            console.error(`Spans: ${spans}`);

            expect(spans).toHaveLength(2);

            const serverSpan = getSpanByKind(spans, 1);
            expect(Object.values(JSON.parse(serverSpan.resource.attributes['process.environ'])).join('').length).toBeLessThanOrEqual(5);
            expect(serverSpan.attributes).toMatchObject(
                {
                    'http.host': 'l',
                    'net.host.name': 'l',
                    'http.method': 'G',
                    'http.user_agent': 'a',
                    'http.flavor': '1',
                    'net.transport': 'i',
                    'net.host.ip': expect.any(String),
                    'net.host.port': expect.any(Number),
                    'net.peer.ip': expect.any(String),
                    'net.peer.port': expect.any(Number),
                    'http.status_code': 200,
                    'http.status_text': 'O',
                    'http.url': 'h',
                    'lumigo.execution_tags.foo': 'f',
                    'lumigo.execution_tags.baz': true
                }
            );
            console.error('Server span matches');

            const clientSpan = getSpanByKind(spans, 2);
            expect(clientSpan.attributes).toMatchObject(
                {
                    'http.url': 'h',
                    'http.method': 'G',
                    'http.target': '/',
                    'net.peer.name': 'd',
                    'http.request.body': '"',
                    'net.peer.ip': '1',
                    'net.peer.port': 443,
                    'http.host': 'd',
                    'http.status_code': 200,
                    'http.status_text': 'O',
                    'http.flavor': '1',
                    'http.request.headers': '{',
                    'http.response.headers': '{',
                    'http.response.body': '"',
                }
            );
            console.error('Client span matches');
        }, TEST_TIMEOUT);
    }, TEST_TIMEOUT);

    test('http test - OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT is set', async () => {
        const spanDumpLog = `${SPANS_DIR}/spans-${COMPONENT_NAME}-otel-attr.json`;

        const { app: testApp, port } = await startTestApp(EXEC_SERVER_FOLDER, COMPONENT_NAME, spanDumpLog, {OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT: '3'});
        app = testApp;

        await issueHttpRequest(
            `http-get://localhost:${port}/large-response`,
            spanDumpLog,
        );

        await waitForExpect(async () => {
            const spans = getSpansFromSpanDump(spanDumpLog);

            console.error(`Spans: ${spans}`);

            expect(spans).toHaveLength(2);

            const serverSpan = getSpanByKind(spans, 1);
            expect(Object.values(JSON.parse(serverSpan.resource.attributes['process.environ'])).join('').length).toBeLessThanOrEqual(7);
            expect(serverSpan.attributes).toMatchObject(
                {
                    'http.host': 'loc',
                    'net.host.name': 'loc',
                    'http.method': 'GET',
                    'http.user_agent': 'axi',
                    'http.flavor': '1.1',
                    'net.transport': 'ip_',
                    'net.host.ip': expect.any(String),
                    'net.host.port': expect.any(Number),
                    'net.peer.ip': expect.any(String),
                    'net.peer.port': expect.any(Number),
                    'http.status_code': 200,
                    'http.status_text': 'OK',
                    'http.url': 'htt',
                    'lumigo.execution_tags.foo': 'bar',
                    'lumigo.execution_tags.date': 1234567
                }
            );
            console.error('Server span matches');

            const clientSpan = getSpanByKind(spans, 2);
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
            );
            console.error('Client span matches');
        }, TEST_TIMEOUT);
    }, TEST_TIMEOUT);

    test('http test - no attributes length environment variable is set, default value is set', async () => {
        const spanDumpLog = `${SPANS_DIR}/spans-${COMPONENT_NAME}-default.json`;

        const { app: testApp, port } = await startTestApp(EXEC_SERVER_FOLDER, COMPONENT_NAME, spanDumpLog);
        app = testApp;

        await issueHttpRequest(
            `http-get://localhost:${port}/large-response`,
            spanDumpLog,
        );

        await waitForExpect(async () => {
            const spans = getSpansFromSpanDump(spanDumpLog);

            console.error(`Spans: ${spans}`);

            expect(spans).toHaveLength(2);

            const serverSpan = getSpanByKind(spans, 1);
            expect(serverSpan.attributes).toMatchObject(
                {
                    'http.host': `localhost:${port}`,
                    'net.host.name': 'localhost',
                    'http.method': 'GET',
                    'http.flavor': '1.1',
                    'net.transport': 'ip_tcp',
                    'net.host.ip': expect.any(String),
                    'net.host.port': expect.any(Number),
                    'net.peer.ip': expect.any(String),
                    'net.peer.port': expect.any(Number),
                    'http.status_code': 200,
                    'http.status_text': 'OK',
                    'http.url': `http://localhost:${port}/large-response`,
                    'lumigo.execution_tags.foo': 'bar',
                    'lumigo.execution_tags.date': 1234567
                }
            );
            console.error('Server span matches');

            const clientSpan = getSpanByKind(spans, 2);
            expect(clientSpan.attributes).toMatchObject(
                {
                    'http.url': 'http://universities.hipolabs.com/search?country=United+States',
                    'http.method': 'GET',
                    'http.target': '/search?country=United+States',
                    'net.peer.name': 'universities.hipolabs.com',
                    'http.request.body': '""',
                    'net.peer.ip': expect.stringMatching(
                        /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$))\b/
                    ),
                    'net.peer.port': 80,
                    'http.host': 'universities.hipolabs.com:80',
                    'http.status_code': 200,
                    'http.status_text': 'OK',
                    'http.flavor': '1.1',
                    'http.request.headers': expect.stringMatching(/{.*}/),
                    'http.response.headers': expect.stringMatching(/{.*}/),
                    'http.response.body': expect.any(String),
                }
            );
            expect(clientAttributes['http.response.body'].length).toEqual(2048);               
            console.error('Client span matches');
        }, TEST_TIMEOUT);
    }, TEST_TIMEOUT);

    test('http test - no trace context set if Amazon Sigv4 header is present', async () => {
        const spanDumpLog = `${SPANS_DIR}/spans-${COMPONENT_NAME}-sigv4.json`;

        const { app: testApp, port } = await startTestApp(EXEC_SERVER_FOLDER, COMPONENT_NAME, spanDumpLog);
        app = testApp;

        await issueHttpRequest(
            `http-get://localhost:${port}/amazon-sigv4`,
            spanDumpLog,
        );

        await waitForExpect(async () => {
            const spans = getSpansFromSpanDump(spanDumpLog);

            console.error(`Spans: ${spans}`);

            expect(spans).toHaveLength(2);

            const serverSpan = getSpanByKind(spans, 1);
            expect(serverSpan.attributes).toMatchObject(
                {
                    'http.host': `localhost:${port}`,
                    'net.host.name': 'localhost',
                    'http.method': 'GET',
                    'http.target': '/amazon-sigv4',
                    'http.flavor': '1.1',
                    'net.transport': 'ip_tcp',
                    'net.host.ip': expect.any(String),
                    'net.host.port': expect.any(Number),
                    'net.peer.ip': expect.any(String),
                    'net.peer.port': expect.any(Number),
                    'http.status_code': 200,
                    'http.status_text': 'OK',
                    'http.url': `http://localhost:${port}/amazon-sigv4`,
                }
            );
            console.error('Server span matches');

            const clientSpan = getSpanByKind(spans, 2);
            expect(clientSpan.attributes).toMatchObject(
                {
                    'http.url': 'https://httpbin.org/status/201',
                    'http.method': 'GET',
                    'http.target': '/status/201',
                    'net.peer.name': 'httpbin.org',
                    'http.request.body': '""',
                    'net.peer.ip': expect.stringMatching(
                        /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$))\b/
                    ),
                    'net.peer.port': 443,
                    'http.host': 'httpbin.org:443',
                    'http.status_code': 201,
                    'http.status_text': 'CREATED',
                    'http.flavor': '1.1',
                    'http.request.headers': expect.not.stringMatching(/{.*traceparent.*}/),
                    'http.response.headers': expect.stringMatching(/{.*}/),
                    'http.response.body': expect.any(String),
                }
            );
            console.error('Client span matches');
        }, TEST_TIMEOUT);
    }, TEST_TIMEOUT);

});

const issueHttpRequest = async (url) => await new Promise((resolve, reject) => {
    waitOn(
        {
            resources: [`${url}`],
            delay: 500,
            interval: 100,
            timeout: WAIT_ON_TIMEOUT,
            simultaneous: 1,
            log: true,
            validateStatus: function (status) {
                console.debug(`Server response status: ${status}`);
                return status >= 200 && status < 300; // default if not provided
            },
        },
        async function (err) {
            if (err) {
                console.error('inside waitOn', err);
                return reject(err)
            }

            resolve();
        }
    );
});