import path from "path";
import { TestApp } from "../../utils/test-apps";
import { reinstallPackages } from "../../utils/test-setup";
import { FakeEdge } from "../../utils/fake-edge";
import tmp from "tmp"
import fs from "fs-extra"

const APP_DIR = path.join(__dirname, 'app');
const SETUP_TIMEOUT = 2 * 60 * 1000;

describe("global distro features", () => {
  let testApp: TestApp;
  const fakeEdge = new FakeEdge();

  beforeAll(async () => {
      await fakeEdge.start();
  }, SETUP_TIMEOUT);

  afterEach(async () => {
    fakeEdge.reset();

    if (testApp) {
      try {
        await testApp.invokeShutdown();
      } catch (err) {
        console.warn('Failed to kill test app: ', err)
      }
    }
  })

  afterAll(() => fakeEdge.stop());

  describe("with distro loaded from same folder as the app", () => {
    beforeAll(() => {
      reinstallPackages({ appDir: APP_DIR });
    })

    describe("disabled traces and logs (LUMIGO_ENABLE_TRACES and LUMIGO_ENABLE_LOGS set to 'false')", () => {
      beforeEach(async () => {
          testApp = new TestApp(
            APP_DIR,
            "test-disabled-tracing-and-logging",
            {
                env: {
                  LUMIGO_TRACER_TOKEN: 't_123456789',
                  LUMIGO_LOGS_ENDPOINT: fakeEdge.logsUrl,
                  LUMIGO_ENDPOINT: fakeEdge.tracesUrl,
                  LUMIGO_ENABLE_TRACES: 'false',
                  LUMIGO_ENABLE_LOGS: 'false'
                }
            }
          );
          await testApp.waitUntilReady()
      }, SETUP_TIMEOUT);

      test('should not send traces and logs', async () => {
        await testApp.invokeGetPath('/');

        await expect(fakeEdge.waitFor(({ logs }) => logs.length > 0, 'waiting for logs')).rejects.toThrow();;
        await expect(fakeEdge.waitFor(({ spans }) => spans.length > 0, 'waiting for traces')).rejects.toThrow();
      }, 2 * 60 * 1000);
    })

    describe("synchronous initialization - Javascript", () => {
      beforeEach(async () => {
          testApp = new TestApp(
            APP_DIR,
            "test-sync-init",
            {
                env: {
                  LUMIGO_TRACER_TOKEN: 't_123456789',
                  LUMIGO_LOGS_ENDPOINT: fakeEdge.logsUrl,
                  LUMIGO_ENDPOINT: fakeEdge.tracesUrl,
                  LUMIGO_ENABLE_LOGS: 'true'
                },
                startupScript: 'start-sync'
            }
          );
          await testApp.waitUntilReady()
      }, SETUP_TIMEOUT);

      test('allows logging without await-ing on the init promise', async () => {
        await testApp.invokeGetPath('/sync-init');

        await expect(fakeEdge.waitFor(({ logs }) => logs.some(log => log.body["stringValue"] === "this log should be exported to Lumigo without init"), 'waiting for logs')).resolves.toBeTruthy();
      }, 2 * 60 * 1000);
    })

    describe("synchronous initialization - Typescript", () => {
      beforeEach(async () => {
          testApp = new TestApp(
            APP_DIR,
            "test-sync-init-ts",
            {
                env: {
                  LUMIGO_TRACER_TOKEN: 't_123456789',
                  LUMIGO_LOGS_ENDPOINT: fakeEdge.logsUrl,
                  LUMIGO_ENDPOINT: fakeEdge.tracesUrl,
                  LUMIGO_ENABLE_LOGS: 'true'
                },
                startupScript: 'start-sync-ts'
            }
          );
          await testApp.waitUntilReady()
      }, SETUP_TIMEOUT);

      test('allows logging without await-ing on the init promise in a Typescript app', async () => {
        await testApp.invokeGetPath('/sync-init');

        await expect(fakeEdge.waitFor(({ logs }) => logs.some(log => log.body["stringValue"] === "this log should be exported to Lumigo without init"), 'waiting for logs')).resolves.toBeTruthy();
      }, 2 * 60 * 1000);
    })
  })

  describe("distro used with NODE_PATH", () => {
    beforeEach(async () => {
      const targetFolder = tmp.dirSync({ keep: !!process.env.CI }).name;
      const sourceFolder = path.join(__dirname, 'separate');
      const targetAppFolder = path.join(targetFolder, "app");
      const targetDistroFolder = path.join(targetFolder, "distro");
      await Promise.all([fs.copy(sourceFolder, targetFolder), fs.copy("distro.tgz", path.join(targetDistroFolder, "distro.tgz"))]);
      await Promise.all([reinstallPackages({ appDir: targetAppFolder }), reinstallPackages({ appDir: targetDistroFolder })]);

      testApp = new TestApp(
        targetAppFolder,
        "app-with-distro-from-another-folder",
        {
            env: {
              LUMIGO_TRACER_TOKEN: 't_123456789',
              LUMIGO_LOGS_ENDPOINT: fakeEdge.logsUrl,
              LUMIGO_ENDPOINT: fakeEdge.tracesUrl,
              LUMIGO_ENABLE_LOGS: 'true'
            }
        }
      );
      await testApp.waitUntilReady()
    }, SETUP_TIMEOUT);

    test('properly resolves modules to instrument relative to the app folder', async () => {
      await testApp.invokeGetPath('/write-log');
      await expect(fakeEdge.waitFor(({ logs }) => logs.some(log => log.body["stringValue"] === "a brother from another folder"), 'waiting for logs', 60 * 1000)).resolves.toBeTruthy();
    }, 2 * 60 * 1000);
  });
})