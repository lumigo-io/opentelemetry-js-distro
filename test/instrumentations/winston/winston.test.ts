import path from 'path';
import { itTest } from '../../integration/setup';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import { FakeEdge } from '../../utils/fake-edge';
import tmp from 'tmp';
import fs from 'fs-extra';

const INSTRUMENTATION_NAME = 'winston';
const LOGS_DIR = path.join(__dirname, 'logs');

describe.each([versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME)[0]])(
  `Instrumentation tests for the ${INSTRUMENTATION_NAME} package`,
  function (versionToTest) {
    let testApp: TestApp;
    const fakeEdge = new FakeEdge();
    let targetAppDir: string;

    beforeAll(async () => {
      await fakeEdge.start();
      await fs.mkdir(LOGS_DIR, { recursive: true });
    });

    beforeEach(async () => {
      // copy the entire test project-root to a temp folder, to isolate dependencies
      const sourceFolder = path.join(__dirname);
      const targetTestProjectDir = tmp.dirSync({ keep: process.env.KEEP_TEMP_TEST_FOLDERS == "true" }).name;
      targetAppDir = path.join(targetTestProjectDir, "app");
      await fs.copy(sourceFolder, targetTestProjectDir),
      await fs.copy("distro.tgz", path.join(targetTestProjectDir, "deps", "distro.tgz"));
      reinstallPackages({ appDir: path.join(targetTestProjectDir, "deps") });
      installPackage({
        appDir: targetAppDir,
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
    });

    itTest(
      {
        testName: `${INSTRUMENTATION_NAME} logger: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: 30_000,
      },
      async function () {
        testApp = new TestApp(targetAppDir, INSTRUMENTATION_NAME, {
          logDumpPath: `${LOGS_DIR}/${INSTRUMENTATION_NAME}.${INSTRUMENTATION_NAME}-logs@${versionToTest}.json`,
          env: {
            LUMIGO_ENABLE_LOGS: 'true',
            LUMIGO_SECRET_MASKING_REGEX: '[".*sekret.*"]',
            LUMIGO_LOGS_ENDPOINT: fakeEdge.logsUrl,
            LUMIGO_ENDPOINT: fakeEdge.tracesUrl,
            LUMIGO_TRACER_TOKEN: 't_123456789',
            NODE_PATH: path.join(targetAppDir, '..', "deps", "node_modules"),
          },
        });

        await writeLogLine('Hello Winston!');
        await writeLogLine({ a: 1, sekret: 'this is secret!' });

        await expect(fakeEdge.waitFor(({ logs }) => logs.length === 2, 'waiting for logs to be processed')).resolves.toBeTruthy();
        await expect(fakeEdge.waitFor(({ resources }) => resources.length >= 1, 'waiting for resources to be processed')).resolves.toBeTruthy();

        expect(fakeEdge.resources[0].attributes).toIncludeAllMembers([
          {
            key: 'service.name',
            value: {
              stringValue: 'winston',
            },
          },
        ])

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

    const writeLogLine = async (logLine: any) =>
      testApp.invokeGetPath(
        `/write-log-line?logLine=${encodeURIComponent(JSON.stringify(logLine))}`
      );
  }
);
