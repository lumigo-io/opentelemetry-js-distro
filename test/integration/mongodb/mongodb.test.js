const { spawnSync } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
require('jest-json');
const { join } = require('path');
const kill = require('tree-kill');
const waitOn = require('wait-on')

const {
    getInstrumentationSpansFromFile, getSpanByName, getFilteredSpans, getExpectedResourceAttributes, getExpectedSpan,
    getExpectedSpanWithParent
} = require('./mongodbTestUtils');
const { callContainer, startTestApp, versionsToTest } = require('../../testUtils/utils');

const SPANS_DIR = `${__dirname}/spans`;
const EXEC_SERVER_FOLDER = 'test/integration/mongodb/app';
const TEST_TIMEOUT = 300000;
const WAIT_ON_TIMEOUT = 80000;
const INTEGRATION_NAME = `mongodb`;
const INSERT_CMD = 'mongodb.insert';
const FIND_CMD = 'mongodb.find';
const UPDATE_CMD = 'mongodb.update';
const REMOVE_CMD = 'mongodb.remove';
const CREATE_INDEX_CMD = 'mongodb.createIndexes';
const DELETE_CMD = 'mongodb.delete';
const expectedIndexStatement = expect.stringMatching(/"createIndexes":"insertOne","indexes":\[{"name":"a_1","key"/);

describe.each(versionsToTest('mongodb', 'mongodb'))('Integration tests mongodb', (versionToTest) => {
    let app = undefined;
    let spans;

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

        const res = spawnSync('npm', ['install', `mongodb@${versionToTest}`], {
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

        const res = spawnSync('npm', ['uninstall', `mongodb@${versionToTest}`], {
            cwd: join(__dirname, 'app'),
        });

        if (res.error) {
            throw new Error(res.error);
        }
    });

    test(`basic mongodb v3 test`, async () => {
        const exporterFile = `${SPANS_DIR}/basic-v3-@${versionToTest}.json`;

        const { app: testApp, port } = await startTestApp(EXEC_SERVER_FOLDER, INTEGRATION_NAME, exporterFile, {OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096'});
        app = testApp;

        console.info(`port: ${port}`)

        const waited = new Promise((resolve, reject) => {
            waitOn(
                {
                    resources: [`http-get://localhost:${port}`],
                    delay: 20000,
                    log: true,
                    validateStatus: function (status) {
                        console.debug('server status:', status);
                        return status >= 200 && status < 300; // default if not provided
                    },
                },
                async function (err) {
                    if (err) {
                        console.error('inside waitOn', err);
                        return reject(err)
                    } else {
                        console.info('Got a response from server');
                        await callContainer(port, 'test-mongodb', 'get');
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
        expect(findSpan).toMatchObject(getExpectedSpanWithParent(FIND_CMD, resourceAttributes, '{"a":1}'));
        expect(updateSpan).toMatchObject(getExpectedSpanWithParent(UPDATE_CMD, resourceAttributes, '{"a":1}'));
        expect(removeSpan).toMatchObject(getExpectedSpanWithParent(REMOVE_CMD, resourceAttributes, '{"b":1}'), '$cmd');
        expect(indexSpan).toMatchObject(getExpectedSpanWithParent(CREATE_INDEX_CMD, resourceAttributes, expectedIndexStatement, '$cmd'));
    }, TEST_TIMEOUT);

    test('basic mongodb V4 test', async () => {
        const exporterFile = `${SPANS_DIR}/basic-v4-@${versionToTest}.json`;

        const { app: testApp, port } = await startTestApp(EXEC_SERVER_FOLDER, INTEGRATION_NAME, exporterFile, {OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096'});
        app = testApp;

        console.info(`port: ${port}`)

        const waited = new Promise((resolve, reject) => {
            waitOn(
                {
                    resources: [`http-get://localhost:${port}`],
                    delay: 10000,
                    timeout: WAIT_ON_TIMEOUT,
                    simultaneous: 1,
                    log: true,
                    validateStatus: function (status) {
                        console.debug('server status:', status);
                        return status >= 200 && status < 300; // default if not provided
                    },
                },
                async function (err) {
                    if (err) {
                        console.error('inside waitOn', err);
                        return reject(err)
                    } else {
                        console.info('Got a response from server');
                        await callContainer(port, 'test-mongodb', 'get');
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
        expect(findSpan).toMatchObject(getExpectedSpanWithParent(FIND_CMD, resourceAttributes, '{"find":"insertOne","filter":{"a":1}}'));
        const expectedUpdateStatement = '{"update":"insertOne","updates":[{"q":{"a":1},"u":{"$set":{"b":1}}}],"ordered":true}';
        expect(updateSpan).toMatchObject(getExpectedSpanWithParent(UPDATE_CMD, resourceAttributes, expectedUpdateStatement));
        const expectedDeleteStatement = '{"delete":"insertOne","deletes":[{"q":{"b":1},"limit":0}],"ordered":true}';
        expect(removeSpan).toMatchObject(getExpectedSpanWithParent(DELETE_CMD, resourceAttributes, expectedDeleteStatement));
        expect(indexSpan).toMatchObject(getExpectedSpanWithParent(CREATE_INDEX_CMD, resourceAttributes, expectedIndexStatement, '$cmd'));
    }, TEST_TIMEOUT);
});
