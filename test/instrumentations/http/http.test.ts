import { ChildProcessWithoutNullStreams, spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync } from 'fs';
import 'jest-json';
import ServerMock from 'mock-http-server';
import { join } from 'path';
import kill from 'tree-kill';

import { getSpanByKind } from '../../utils/spans';
import { invokeHttpAndGetSpanDump, startTestApp } from '../../utils/test-apps';

const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 20_000;
const INSTRUMENTATION_NAME = 'http';

const expectedResourceAttributes = {
    attributes: {
        'service.name': 'http',
        'telemetry.sdk.language': 'nodejs',
        'telemetry.sdk.name': 'opentelemetry',
        'telemetry.sdk.version': expect.any(String),
        'framework': 'node',
        'process.environ': expect.jsonMatching(
            expect.objectContaining({
                'OTEL_SERVICE_NAME': 'http',
                'LUMIGO_ENDPOINT' :'https://walle-edge-app-us-west-2.walle.golumigo.com'
            })),
        'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
        'process.pid': expect.any(Number),
        'process.executable.name': 'node',
        'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
        'process.runtime.name': 'nodejs',
        'process.runtime.description': 'Node.js',
    }
};

describe('Instrumentation tests for the http package', function () {
    let app: ChildProcessWithoutNullStreams | undefined;
    let server: Server | undefined;

    beforeAll(() => {
        const appDir = `${__dirname}/app`;
        if (existsSync(`${appDir}/node_modules`)) {
            rmdirSync(`${appDir}/node_modules`, {
                recursive: true,
            });
        }

        if (existsSync(`${appDir}/package-lock.json`)) {
            unlinkSync(`${appDir}/package-lock.json`);
        }

        const { error } = spawnSync('npm', ['install'], {
            cwd: join(__dirname, 'app'),
        });

        if (error) {
            throw error;
        }

        if (!existsSync(SPANS_DIR)) {
            mkdirSync(SPANS_DIR);
        }
    });

    afterEach(async () => {
        if (server) {
            var promiseResolve: Function = () => {};
            const p = new Promise(function(resolve) {
                promiseResolve = resolve;
            });

            server.stop(promiseResolve);
            await p;
            server = undefined;
        }

        if (app) {
            kill(app.pid!, 'SIGHUP');
            app = undefined;
            // Wait 100 ms to give the app time to shutdown
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    });

    test('basic http test', async () => {
        const spanDumpPath = `${SPANS_DIR}/spans-${INSTRUMENTATION_NAME}-basic.json`;

        const { targetServer, targetPort } = await startTargetServer();
        targetServer.on({
            method: 'GET',
            path: '/jokes/categories',
            reply: {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify(['animal', 'career', 'celebrity', 'dev', 'explicit', 'fashion', 'food', 'history', 'money', 'movie', 'music', 'political', 'religion', 'science', 'sport', 'travel']),
            }
        });
        server = targetServer;

        const { app: testApp, port } = await startTestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, spanDumpPath, {
            LUMIGO_ENDPOINT: 'https://walle-edge-app-us-west-2.walle.golumigo.com',
            LUMIGO_TRACER_TOKEN: 't_123321',
            TARGET_URL: `http://localhost:${targetPort}`,
        });
        app = testApp;

        const spans = await invokeHttpAndGetSpanDump(`http-get://localhost:${port}/test1`, spanDumpPath);

        expect(spans).toHaveLength(2);

        const serverSpan = getSpanByKind(spans, 1);
        expect(serverSpan).toMatchObject({
            traceId: expect.any(String),
            id: expect.any(String),
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            name: 'GET',
            kind: 1,
            resource: expectedResourceAttributes,
            attributes: {
                'http.flavor': '1.1',
                'http.url': expect.stringMatching(/http:\/\/localhost:\d+\/test/),
                'http.host': expect.stringMatching(/localhost:\d+/),
                'http.method': 'GET',
                'http.status_code': 200,
                'http.status_text': 'OK',
                'lumigo.execution_tags.foo': ['bar', 'baz']
            },
            status: {
                code: 0,
            },
            events: [],
        });

        const clientSpan = getSpanByKind(spans, 2);
        expect(clientSpan).toMatchObject({
            traceId: expect.any(String),
            parentId: expect.any(String),
            id: expect.any(String),
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            name: 'GET',
            kind: 2,
            attributes: {
                'http.flavor': '1.1',
                'http.url': `http://localhost:${targetPort}/jokes/categories`,
                'http.method': 'GET',
                'http.status_code': 200,
                'http.status_text': 'OK',
                'http.target': '/jokes/categories',
                'http.request.body': '""',
                'http.request.headers': expect.stringMatching(/{.*}/),
                'http.response.headers': expect.stringMatching(/{.*}/),
                'http.response.body': expect.jsonMatching(['animal', 'career', 'celebrity', 'dev', 'explicit', 'fashion', 'food', 'history', 'money', 'movie', 'music', 'political', 'religion', 'science', 'sport', 'travel']),
            },
            status: {
                code: 0,
            },
            events: [],
        });
    }, TEST_TIMEOUT);

    test('http test - OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT is set', async () => {
        const spanDumpPath = `${SPANS_DIR}/spans-${INSTRUMENTATION_NAME}-span-attr.json`;

        const { targetServer, targetPort } = await startTargetServer();
        targetServer.on({
            method: 'GET',
            path: '/api/breeds/image/random',
            reply: {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({"message":"https:\/\/images.dog.ceo\/breeds\/germanshepherd\/n02106662_13912.jpg","status":"success"}),
            }
        });
        server = targetServer;

        const { app: testApp, port } = await startTestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, spanDumpPath, {
            OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '1',
            TARGET_URL: `http://localhost:${targetPort}`,
        });
        app = testApp;

        const spans = await invokeHttpAndGetSpanDump(`http-get://localhost:${port}/test2`, spanDumpPath);

        expect(spans).toHaveLength(2);

        const serverSpan = getSpanByKind(spans, 1);
        expect(Object.values(JSON.parse(serverSpan.resource.attributes['process.environ'] as string)).join('').length).toBeLessThanOrEqual(5);
        expect(serverSpan.attributes).toMatchObject(
            {
                'http.host': 'l',
                'net.host.name': 'l',
                'http.method': 'G',
                'http.user_agent': 'a',
                'http.flavor': '1',
                'http.status_code': 200,
                'http.status_text': 'O',
                'http.url': 'h',
                'lumigo.execution_tags.foo': 'f',
                'lumigo.execution_tags.baz': true
            }
        );

        const clientSpan = getSpanByKind(spans, 2);
        expect(clientSpan.attributes).toMatchObject(
            {
                'http.url': 'h',
                'http.method': 'G',
                'http.target': '/',
                'http.request.body': '"',
                'http.host': 'l',
                'http.status_code': 200,
                'http.status_text': 'O',
                'http.flavor': '1',
                'http.request.headers': '{',
                'http.response.headers': '{',
                'http.response.body': '"',
            }
        );
    }, TEST_TIMEOUT);

    test('http test - OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT is set', async () => {
        const spanDumpPath = `${SPANS_DIR}/spans-${INSTRUMENTATION_NAME}-otel-attr.json`;

        const { targetServer, targetPort } = await startTargetServer();
        targetServer.on({
            method: 'GET',
            path: '/search',
            reply: {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                },
                body: readFileSync(join(__dirname, 'test-resources', 'large-response.json')),
            }
        });
        server = targetServer;

        const { app: testApp, port } = await startTestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, spanDumpPath, {
            OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT: '3',
            TARGET_URL: `http://localhost:${targetPort}`,
        });
        app = testApp;

        const spans = await invokeHttpAndGetSpanDump(`http-get://localhost:${port}/large-response`, spanDumpPath);

        expect(spans).toHaveLength(2);

        const serverSpan = getSpanByKind(spans, 1);
        expect(Object.values(JSON.parse(serverSpan.resource.attributes['process.environ'] as string)).join('').length).toBeLessThanOrEqual(7);
        expect(serverSpan.attributes).toMatchObject(
            {
                'http.host': 'loc',
                'http.method': 'GET',
                'http.user_agent': 'axi',
                'http.flavor': '1.1',
                'http.status_code': 200,
                'http.status_text': 'OK',
                'http.url': 'htt',
                'lumigo.execution_tags.foo': 'bar',
                'lumigo.execution_tags.date': 1234567
            }
        );

        const clientSpan = getSpanByKind(spans, 2);
        expect(clientSpan.attributes).toMatchObject(
            {
                'http.url': 'htt',
                'http.method': 'GET',
                'http.host': `loc`,
                'http.target': '/se',
                'http.request.body': '""',
                'http.status_code': 200,
                'http.status_text': 'OK',
                'http.flavor': '1.1',
                'http.request.headers': '{"a',
                'http.response.headers': '{"c',
                'http.response.body': '"[{',
            }
        );
    }, TEST_TIMEOUT);

    test('http test - no attributes length environment variable is set, default value is set', async () => {
        const spanDumpPath = `${SPANS_DIR}/spans-${INSTRUMENTATION_NAME}-default-attr-length.json`;

        const { targetServer, targetPort } = await startTargetServer();
        targetServer.on({
            method: 'GET',
            path: '/search',
            reply: {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                },
                body: readFileSync(join(__dirname, 'test-resources', 'large-response.json')),
            }
        });
        server = targetServer;

        const { app: testApp, port } = await startTestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, spanDumpPath, {
            TARGET_URL: `http://localhost:${targetPort}`,
        });
        app = testApp;

        const spans = await invokeHttpAndGetSpanDump(`http-get://localhost:${port}/large-response`, spanDumpPath);

        expect(spans).toHaveLength(2);

        const serverSpan = getSpanByKind(spans, 1);
        expect(serverSpan.attributes).toMatchObject(
            {
                'http.host': `localhost:${port}`,
                'net.host.name': 'localhost',
                'http.method': 'GET',
                'http.flavor': '1.1',
                'http.status_code': 200,
                'http.status_text': 'OK',
                'http.url': `http://localhost:${port}/large-response`,
                'lumigo.execution_tags.foo': 'bar',
                'lumigo.execution_tags.date': 1234567
            }
        );

        const clientSpan = getSpanByKind(spans, 2);
        expect(clientSpan.attributes).toMatchObject(
            {
                'http.url': `http://localhost:${targetPort}/search`,
                'http.method': 'GET',
                'http.host': `localhost:${targetPort}`,
                'http.target': '/search',
                'http.request.body': '""',
                'http.status_code': 200,
                'http.status_text': 'OK',
                'http.flavor': '1.1',
                'http.request.headers': expect.stringMatching(/{.*}/),
                'http.response.headers': expect.stringMatching(/{.*}/),
                'http.response.body': expect.stringMatching(/(.*){2048}/),
            }
        );
    }, TEST_TIMEOUT);

    test('http test - no trace context set if Amazon Sigv4 header is present', async () => {
        const spanDumpPath = `${SPANS_DIR}/spans-${INSTRUMENTATION_NAME}-sigv4.json`;

        const { targetServer, targetPort } = await startTargetServer();
        targetServer.on({
            method: 'POST',
            path: '/amazon-sigv4',
            reply: {
                status: 201,
                headers: {
                    'content-type': 'text/plain',
                },
                body: '',
            }
        });
        server = targetServer;

        const { app: testApp, port } = await startTestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, spanDumpPath, {
            TARGET_URL: `http://localhost:${targetPort}`,
            LUMIGO_DEBUG: 'true',
        });
        app = testApp;

        const spans = await invokeHttpAndGetSpanDump(`http-get://localhost:${port}/amazon-sigv4`, spanDumpPath);

        expect(spans).toHaveLength(2);

        const serverSpan = getSpanByKind(spans, 1);
        expect(serverSpan.attributes).toMatchObject(
            {
                'http.host': `localhost:${port}`,
                'http.method': 'GET',
                'http.target': '/amazon-sigv4',
                'http.flavor': '1.1',
                'http.status_code': 200,
                'http.status_text': 'OK',
                'http.url': `http://localhost:${port}/amazon-sigv4`,
            }
        );

        const clientSpan = getSpanByKind(spans, 2);
        expect(clientSpan.attributes).toMatchObject(
            {
                'http.url': `http://localhost:${targetPort}/amazon-sigv4`,
                'http.method': 'POST',
                'http.target': '/amazon-sigv4',
                'http.host': `localhost:${targetPort}`,
                'http.status_code': 201,
                'http.status_text': 'CREATED',
                'http.flavor': '1.1',
                'http.request.headers': expect.not.stringMatching(/{.*traceparent.*}/),
                'http.request.body': '""',
                'http.response.headers': expect.any(String),
                'http.response.body': '""',
            }
        );
    }, TEST_TIMEOUT);

});

// Unfortunately `mock-http-server` is not TS-friendly
interface Server {
    stop: Function;
    on: Function;
}

const startTargetServer = async (): Promise<{targetServer: Server, targetPort: number}> => {
    var promiseResolve: Function = () => {}; // Useless asignment to make TS happy
    const p = new Promise(function(resolve) {
        promiseResolve = resolve;
    });

    const targetPort = 9000;
    var targetServer = new ServerMock({
        host: 'localhost',
        port: targetPort,
    }, undefined);
    targetServer.start(promiseResolve);

    await p;

    return {
        targetServer,
        targetPort,
    };
}