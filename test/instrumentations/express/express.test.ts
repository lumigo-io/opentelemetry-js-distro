import { ChildProcessWithoutNullStreams, spawnSync } from 'child_process';
import { existsSync, mkdirSync, rmdirSync, unlinkSync } from 'fs';
import 'jest-json';
import { join } from 'path';
import kill from 'tree-kill';

import { invokeHttpAndGetSpanDump, startTestApp } from '../../utils/test-apps';
import { versionsToTest } from '../../utils/versions';

const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 20_000;
const INSTRUMENTATION_NAME = `express`;

const expectedResourceAttributes = {
    attributes: {
        'service.name': 'express',
        'telemetry.sdk.language': 'nodejs',
        'telemetry.sdk.name': 'opentelemetry',
        'telemetry.sdk.version': expect.any(String),
        framework: 'express',
        'process.environ': expect.jsonMatching(
            expect.objectContaining({
                'OTEL_SERVICE_NAME': 'express',
            })),
        'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
        'process.pid': expect.any(Number),
        'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
        'process.runtime.name': 'nodejs',
        'process.executable.name': 'node',
    },
};

describe.each(versionsToTest('express', 'express'))('Instrumentation tests for the express package', (versionToTest) => {

    let app: ChildProcessWithoutNullStreams;

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

    beforeEach(() => {
        const { error } = spawnSync('npm', ['install', `express@${versionToTest}`], {
            cwd: join(__dirname, 'app'),
        });

        if (error) {
            throw error;
        }
    });

    afterEach(() => {
        if (app) {
            kill(app.pid!, 'SIGHUP');
        }

        const { error } = spawnSync('npm', ['uninstall', `express@${versionToTest}`], {
            cwd: join(__dirname, 'app'),
        });

        if (error) {
            throw error;
        }
    });

    test(`express@${versionToTest} basics`, async () => {
        const exporterFile = `${SPANS_DIR}/basic-express@${versionToTest}.json`;

        const { app: testApp, port } = await startTestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, { OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096' });
        app = testApp;

        const spans = await invokeHttpAndGetSpanDump(`http-get://localhost:${port}/basic`, exporterFile);

        // expect(spans).toHaveLength(2); // TODO Why do we occasionally get two spans?
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

    test(`express@${versionToTest} secret masking requests`, async () => {
        const exporterFile = `${SPANS_DIR}/secret-masking-express@${versionToTest}.json`;

        const { app: testApp, port } = await startTestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, { OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096' });
        app = testApp;

        const spans = await invokeHttpAndGetSpanDump(`http-get://localhost:${port}/test-scrubbing`, exporterFile);

        // expect(spans).toHaveLength(2); // TODO Why do we occasionally get two spans?
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