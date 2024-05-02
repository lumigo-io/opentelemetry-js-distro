import fs from 'fs';
import { join } from 'path';
import { itTest } from '../../integration/setup';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import { FakeEdge } from '../../utils/fake-edge';
import { setTimeout } from 'timers/promises';

const INSTRUMENTATION_NAME = 'winston';
const LOGS_DIR = join(__dirname, 'logs');
const TEST_APP_DIR = join(__dirname, 'app');

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(
  `Instrumentation tests for the ${INSTRUMENTATION_NAME} package`,
  function (versionToTest) {
    let testApp: TestApp;
    const fakeEdge = new FakeEdge();

    beforeAll(async () => {
      await fakeEdge.start();

      reinstallPackages({ appDir: TEST_APP_DIR });
      fs.mkdirSync(LOGS_DIR, { recursive: true });
      installPackage({
        appDir: TEST_APP_DIR,
        packageName: INSTRUMENTATION_NAME,
        packageVersion: versionToTest,
      });
    });

    afterEach(async () => {
      fakeEdge.reset();

      if (testApp) {
        await testApp.kill();
      }
    });

    afterAll(async () => {
      await fakeEdge.stop();
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
        timeout: 20_000,
      },
      async function () {
        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, {
          logDumpPath: `${LOGS_DIR}/${INSTRUMENTATION_NAME}.${INSTRUMENTATION_NAME}-logs@${versionToTest}.json`,
          env: {
            LUMIGO_ENABLE_LOGS: 'true',
            LUMIGO_SECRET_MASKING_REGEX: '[".*sekret.*"]',
            LUMIGO_LOGS_ENDPOINT: fakeEdge.logsUrl,
            LUMIGO_ENDPOINT: fakeEdge.tracesUrl,
            LUMIGO_TRACER_TOKEN: 't_123456789',
          },
        });

        await writeLogLine('Hello Winston!');
        await writeLogLine({ a: 1, sekret: 'this is secret!' });

        await fakeEdge.waitFor(
          () => fakeEdge.resources.length == 1,
          'waiting for resources to be processed'
        );
        await fakeEdge.waitFor(() => fakeEdge.logs.length == 2, 'waiting for logs to be processed');

        expect(fakeEdge.resources[0].attributes).toIncludeAllMembers([
          {
            key: 'service.name',
            value: {
              stringValue: 'winston',
            },
          },
        ]);

        expect(fakeEdge.logs[0].body).toEqual({ stringValue: 'Hello Winston!' });
        // Span context is available since the test app is an instrumented HTTP server
        expect(fakeEdge.logs[0]['traceId']).toHaveLength(32);
        expect(fakeEdge.logs[0]['spanId']).toHaveLength(16);

        expect(fakeEdge.logs[1].body).toMatchObject({
          kvlistValue: {
            values: [
              { key: 'a', value: { intValue: 1 } },
              { key: 'sekret', value: { stringValue: '****' } },
            ],
          },
        });
        expect(fakeEdge.logs[1]['traceId']).toHaveLength(32);
        expect(fakeEdge.logs[1]['spanId']).toHaveLength(16);

        // Test the log-dump functionality
        await testApp.getFinalLogs(2);
      }
    );

    itTest(
      {
        testName: `${INSTRUMENTATION_NAME} logger: ${versionToTest} - logging off`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: 20_000,
      },
      async function () {
        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, {
          logDumpPath: `${LOGS_DIR}/${INSTRUMENTATION_NAME}.${INSTRUMENTATION_NAME}-logs-off@${versionToTest}.json`,
          env: {
            LUMIGO_ENABLE_LOGS: 'false',
          },
        });

        await writeLogLine('Hello Winston!');

        // We expect no logs to be sent, therefore waiting for 1 log should fail
        await expect(testApp.getFinalLogs(1)).rejects.toThrow();
      }
    );

    const writeLogLine = async (logLine: any) =>
      testApp.invokeGetPath(
        `/write-log-line?logLine=${encodeURIComponent(JSON.stringify(logLine))}`
      );
  }
);
