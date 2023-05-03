const { spawnSync } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
require('jest-json');
const { join } = require('path');
const kill = require('tree-kill');
const waitOn = require('wait-on')

const { readSpans, startTestApp, versionsToTest } = require('../../testUtils/utils');

const SPANS_DIR = join(__dirname, 'spans');
const EXEC_SERVER_FOLDER = join(__dirname, 'app');
const TEST_TIMEOUT = 20_000;
const WAIT_ON_INITIAL_DELAY = 3_000;
const WAIT_ON_TIMEOUT = 10_000;
const INTEGRATION_NAME = `express`;

const expectedResourceAttributes = {
    attributes: {
        'service.name': 'express',
        'telemetry.sdk.language': 'nodejs',
        'telemetry.sdk.name': 'opentelemetry',
        'telemetry.sdk.version': expect.any(String),
        framework: 'express',
        'process.environ': expect.jsonMatching(
            expect.objectContaining({
                "OTEL_SERVICE_NAME": "express",
            })),
        'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
        'process.pid': expect.any(Number),
        'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
        'process.runtime.name': 'nodejs',
        'process.executable.name': 'node',
    },
};

describe.each(versionsToTest('express', 'express'))(`Integration tests express`, (versionToTest) => {

    let app;

    beforeAll(() => {
        const res = spawnSync('npm', ['install'], {
            cwd: join(__dirname, 'app'),
        });

        if (res.error) {
            throw new Error(res.error);
        }

        if (!existsSync(SPANS_DIR)) {
            mkdirSync(SPANS_DIR);
        }
    });

    beforeEach(() => {
        console.info(`beforeEach '${versionToTest}': install dependencies`)

        const res = spawnSync('npm', ['install', `express@${versionToTest}`], {
            cwd: join(__dirname, 'app'),
        });

        if (res.error) {
            throw new Error(res.error);
        }
    });

    afterEach(() => {
        console.info(`afterEach '${versionToTest}': stop test app`);
        if (app) {
            kill(app.pid, 'SIGHUP');
        }

        console.info(`afterEach '${versionToTest}': uninstall tested version`);

        const res = spawnSync('npm', ['uninstall', `express@${versionToTest}`], {
            cwd: join(__dirname, 'app'),
        });

        if (res.error) {
            throw new Error(res.error);
        }
    });

    test('basic', async () => {
        const exporterFile = `${SPANS_DIR}/basic-express@${versionToTest}.json`;

        const { app: testApp, port } = startTestApp(EXEC_SERVER_FOLDER, INTEGRATION_NAME, exporterFile, { OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096' });
        app = testApp;

        await waitOn({
            resources: [`http-get://localhost:${port}/basic`],
            delay: WAIT_ON_INITIAL_DELAY,
            timeout: WAIT_ON_TIMEOUT,
            simultaneous: 1,
            log: true,
            validateStatus: function (status) {
                return status >= 200 && status < 300; // default if not provided
            },
        });

        const spans = readSpans(exporterFile);
        expect(spans[0]).toMatchObject({
            traceId: expect.any(String),
            parentId: expect.any(String),
            name: 'GET /basic',
            id: expect.any(String),
            kind: 0,
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            resource: expectedResourceAttributes,
            attributes: {
                'http.method': 'GET',
                'http.target': '/basic',
                'http.flavor': '1.1',
                'http.host': expect.stringMatching(/localhost:\d+/),
                'http.scheme': 'http',
                'net.peer.ip': expect.any(String),
                'http.request.query': '{}',
                'http.request.headers': expect.stringMatching(/\{.*\}/),
                'http.response.headers': expect.stringMatching(/\{.*\}/),
                'http.response.body': '"Hello world"',
                'http.request.body': '{}',
                'http.route': '/basic',
                'express.route.full': '/basic',
                'express.route.configured': '/basic',
                'express.route.params': '{}',
                'http.status_code': 200,
            },
            status: {
                code: 1,
            },
            events: [],
        });
    }, TEST_TIMEOUT);

    test('secret masking requests', async () => {
        const exporterFile = `${SPANS_DIR}/secret-masking-express@${versionToTest}.json`;

        const { app: testApp, port } = startTestApp(EXEC_SERVER_FOLDER, INTEGRATION_NAME, exporterFile, { OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096' });
        app = testApp;

        await waitOn({
            resources: [`http-get://localhost:${port}/test-scrubbing`],
            delay: WAIT_ON_INITIAL_DELAY,
            timeout: WAIT_ON_TIMEOUT,
            simultaneous: 1,
            log: true,
            validateStatus: function (status) {
                return status >= 200 && status < 300; // default if not provided
            },
        });

        const spans = readSpans(exporterFile);
        expect(spans[0]).toMatchObject({
            traceId: expect.any(String),
            parentId: expect.any(String),
            name: 'GET /test-scrubbing',
            id: expect.any(String),
            kind: 0,
            timestamp: expect.any(Number),
            duration: expect.any(Number),
            resource: expectedResourceAttributes,
            attributes: {
                'http.method': 'GET',
                'http.target': '/test-scrubbing',
                'http.flavor': '1.1',
                'http.host': expect.stringMatching(/localhost:\d+/),
                'http.scheme': 'http',
                'net.peer.ip': expect.any(String),
                'http.request.query': '{}',
                'http.request.headers': expect.stringMatching(/\{.*\}/),
                'http.response.headers': expect.stringMatching(/\{.*\}/),
                'http.response.body': expect.jsonMatching({ Authorization: '****' }),
                'http.request.body': '{}',
                'http.route': '/test-scrubbing',
                'express.route.full': '/test-scrubbing',
                'express.route.configured': '/test-scrubbing',
                'express.route.params': '{}',
                'http.status_code': 200,
            },
            status: {
                code: 1,
            },
            events: [],
        });
    }, TEST_TIMEOUT);

});