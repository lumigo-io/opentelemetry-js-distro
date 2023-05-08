import { ChildProcessWithoutNullStreams } from 'child_process';
import { join } from 'path';
import 'jest-json';

import { filterMongoSpans, getExpectedResourceAttributes, getExpectedSpan, getExpectedSpanWithParent } from './mongodbTestUtils';
import { getSpanByName } from '../../utils/spans';
import { invokeHttpAndGetSpanDump, startTestApp } from '../../utils/test-apps';
import { versionsToTest } from '../../utils/versions';
import { ensureDirExists, installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { sleep } from '../../utils/time';

const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 300000;
const INSTRUMENTATION_NAME = `mongodb`;
const INSERT_CMD = 'mongodb.insert';
const FIND_CMD = 'mongodb.find';
const UPDATE_CMD = 'mongodb.update';
const REMOVE_CMD = 'mongodb.remove';
const CREATE_INDEX_CMD = 'mongodb.createIndexes';
const DELETE_CMD = 'mongodb.delete';
const expectedIndexStatement = expect.stringMatching(/"createIndexes":"insertOne","indexes":\[{"name":"a_1","key"/);

describe.each(versionsToTest('mongodb', 'mongodb'))('Instrumentation tests for the \'mongodb\' package', (versionToTest) => {
    let app: ChildProcessWithoutNullStreams;

    beforeAll(() => {
        reinstallPackages(TEST_APP_DIR);
        ensureDirExists(SPANS_DIR);
    });

    beforeEach(() => {
        installPackage(TEST_APP_DIR, 'mongodb', versionToTest);
    });

    afterEach(async () => {
        app?.kill('SIGHUP');

        await sleep(200);

        uninstallPackage(TEST_APP_DIR, 'express', versionToTest);
    });

    test('basics', async () => {
        const spanDumpPath = `${SPANS_DIR}/basic-v3-@${versionToTest}.json`;

        const { app: testApp, port } = await startTestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, spanDumpPath, {OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096'});
        app = testApp;

        const spans = await invokeHttpAndGetSpanDump(`http-get://localhost:${port}/test-mongodb`, spanDumpPath);

        expect(filterMongoSpans(spans)).toHaveLength(5);
        
        let resourceAttributes = getExpectedResourceAttributes();
        
        expect(getSpanByName(spans, INSERT_CMD)).toMatchObject(getExpectedSpan(INSERT_CMD, resourceAttributes, expect.stringMatching(/"a":1,"_id":/)));
        
        const findSpan = getSpanByName(spans, FIND_CMD);
        if (versionToTest.startsWith('3')) {
            expect(findSpan).toMatchObject(getExpectedSpanWithParent(FIND_CMD, resourceAttributes, '{"a":1}'));
        } else {
            expect(findSpan).toMatchObject(getExpectedSpanWithParent(FIND_CMD, resourceAttributes, '{"find":"insertOne","filter":{"a":1}}'));
        }
        
        const updateSpan = getSpanByName(spans, UPDATE_CMD);
        if (versionToTest.startsWith('3')) {
            expect(updateSpan).toMatchObject(getExpectedSpanWithParent(UPDATE_CMD, resourceAttributes, '{"a":1}'));
        } else {
            expect(updateSpan).toMatchObject(getExpectedSpanWithParent(UPDATE_CMD, resourceAttributes, '{"update":"insertOne","updates":[{"q":{"a":1},"u":{"$set":{"b":1}}}],"ordered":true}'));
        }

        if (versionToTest.startsWith('3')) {
            expect(getSpanByName(spans, REMOVE_CMD)).toMatchObject(getExpectedSpanWithParent(REMOVE_CMD, resourceAttributes, '{"b":1}'));
        } else {
            expect(getSpanByName(spans, DELETE_CMD)).toMatchObject(getExpectedSpanWithParent(DELETE_CMD, resourceAttributes, '{"delete":"insertOne","deletes":[{"q":{"b":1},"limit":0}],"ordered":true}'));
        }

        expect(getSpanByName(spans, CREATE_INDEX_CMD)).toMatchObject(getExpectedSpanWithParent(CREATE_INDEX_CMD, resourceAttributes, expectedIndexStatement, '$cmd'));
    }, TEST_TIMEOUT);

});