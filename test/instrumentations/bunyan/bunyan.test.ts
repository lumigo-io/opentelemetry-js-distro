import fs from 'fs';
import { join } from 'path';
import { itTest } from '../../integration/setup';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';

const INSTRUMENTATION_NAME = 'bunyan';
const LOGS_DIR = join(__dirname, 'logs');
const TEST_APP_DIR = join(__dirname, 'app');

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(
  `Instrumentation tests for the ${INSTRUMENTATION_NAME} package`,
  function (versionToTest) {
    let testApp: TestApp;

    beforeAll(() => {
      reinstallPackages({ appDir: TEST_APP_DIR });
      fs.mkdirSync(LOGS_DIR, { recursive: true });
      installPackage({
        appDir: TEST_APP_DIR,
        packageName: INSTRUMENTATION_NAME,
        packageVersion: versionToTest,
      });
    });

    afterEach(async function () {
      if (testApp) {
        console.info('Killing test app...');
        await testApp.kill();
      } else {
        console.warn('Test app was not run.');
      }
    });

    afterAll(() => {
      uninstallPackage({
        appDir: TEST_APP_DIR,
        packageName: INSTRUMENTATION_NAME,
        packageVersion: versionToTest,
      });
    });

    itTest(
      {
        testName: `${INSTRUMENTATION_NAME} logger: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: 10_000
      },
      async function () {
        const logDumpPath = `${LOGS_DIR}/${INSTRUMENTATION_NAME}.${INSTRUMENTATION_NAME}-logs@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, { logDumpPath, env: { LUMIGO_LOGS_ENABLED: 'true', LUMIGO_SECRET_MASKING_REGEX: "[\".*sekret.*\"]" } });

        const logLine = 'Hello Bunyan!';
        await testApp.invokeGetPath(`/write-log-line?logLine=${encodeURIComponent(logLine)}`);

        const secretLogLine = JSON.stringify({ a: 1, sekret: 'this is secret!' });
        await testApp.invokeGetPath(`/write-log-line?logLine=${encodeURIComponent(secretLogLine)}&format=json`);

        const logs = await testApp.getFinalLogs(2);

        expect(logs[0].body).toEqual(logLine);
        // Span context is available since the test app is an instrumented HTTP server
        expect(logs[0]["traceId"]).toHaveLength(32);
        expect(logs[0]["spanId"]).toHaveLength(16);

        expect(logs[1].attributes).toMatchObject({ a: 1, sekret: '****' });
        expect(logs[1]["traceId"]).toHaveLength(32);
        expect(logs[1]["spanId"]).toHaveLength(16);
      }
    );
  }
);
