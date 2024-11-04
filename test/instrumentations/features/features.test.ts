import path from "path";
import { TestApp } from "../../utils/test-apps";
import { reinstallPackages } from "../../utils/test-setup";
import { FakeEdge } from "../../utils/fake-edge";

const APP_DIR = path.join(__dirname, 'app');
const SETUP_TIMEOUT = 2 * 60 * 1000;

describe("global distro features", () => {
  let testApp: TestApp;
  const fakeEdge = new FakeEdge();

  beforeAll(async () => {
      await fakeEdge.start();
      reinstallPackages({ appDir: APP_DIR });
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

  describe("synchronous initialization", () => {
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
      await testApp.invokeGetPath('/no-init');

      await expect(fakeEdge.waitFor(({ logs }) => logs.some(log => log.body["stringValue"] === "this log should be exported to Lumigo without init"), 'waiting for logs')).resolves.toBeTruthy();
    }, 2 * 60 * 1000);
  })
})