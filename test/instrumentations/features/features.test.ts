import path from "path";
import { TestApp } from "../../utils/test-apps";
import { reinstallPackages } from "../../utils/test-setup";
import { FakeEdge } from "../../utils/fake-edge";
import tmp from "tmp"
import fs from "fs-extra"

const APP_DIR = path.join(__dirname, 'app');
const MINUTE = 60 * 1000;
const SETUP_TIMEOUT = 2 * MINUTE;

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
      }, 2 * MINUTE);
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
      }, 2 * MINUTE);
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
      }, 2 * MINUTE);
    })
  })

  describe("resolving instrumented packages", () => {
    let targetFolder

    beforeAll(async () => {
      targetFolder = tmp.dirSync({ keep: process.env.KEEP_TEMP_TEST_FOLDERS == "true" }).name;

      const sourceFolder = path.join(__dirname, "require-precedence");

      // copy the entire test project-root to a temp folder, to isolate the tests from any
      // node_modules folders used in this repo
      await fs.copy(sourceFolder, targetFolder),

      // copy the distro tar.gz file to the tests projects using it as a dependency
      await Promise.all([
        fs.copy("distro.tgz", path.join(targetFolder, "app-with-distro-dep", "distro.tgz")),
        fs.copy("distro.tgz", path.join(targetFolder, "app-with-logger-and-distro-deps", "distro.tgz")),
        fs.copy("distro.tgz", path.join(targetFolder, "distro-only", "distro.tgz")),
      ]);

      // run `npm install` in test projects with package.json
      await Promise.all([
        reinstallPackages({ appDir: path.join(targetFolder, "app-with-distro-dep") }),
        reinstallPackages({ appDir: path.join(targetFolder, "app-with-logger-and-distro-deps") }),
        reinstallPackages({ appDir: path.join(targetFolder, "app-with-logger-dep") }),
        reinstallPackages({ appDir: path.join(targetFolder, "distro-only") }),
        reinstallPackages({ appDir: path.join(targetFolder, "logger-only") })
      ]);
    });

    describe.each`
    testFolder                            | NODE_PATH                         | description
    ${"app-with-logger-and-distro-deps"}  | ${undefined}                      | ${"both distro and instrumented module are direct deps of the app"}
    ${"app-with-logger-dep"}              | ${"../distro-only/node_modules"}  | ${"instrumented package is a direct dep of the app, distro is loaded via NODE_PATH"}
    ${"app-with-distro-dep"}              | ${"../logger-only/node_modules"}  | ${"distro is a direct dep of the app, instrumented package is loaded via NODE_PATH"}
    `("$description", ({ testFolder, NODE_PATH, description }) => {
      beforeEach(async () => {
        testApp = new TestApp(
          path.join(targetFolder, testFolder),
          description.replace(/ /g, "-"),
          {
              env: {
                LUMIGO_TRACER_TOKEN: 't_123456789',
                LUMIGO_LOGS_ENDPOINT: fakeEdge.logsUrl,
                LUMIGO_ENDPOINT: fakeEdge.tracesUrl,
                LUMIGO_ENABLE_LOGS: 'true',
                NODE_PATH
              }
          },
        );
        await testApp.waitUntilReady()
      }, SETUP_TIMEOUT);

      test('properly resolves modules to instrument relative to the app folder', async () => {
        await testApp.invokeGetPath(`/write-log`);
        await expect(fakeEdge.waitFor(({ logs }) => logs.some(log => log.body["stringValue"] === "sure thing it works!"), 'waiting for logs', MINUTE)).resolves.toBeTruthy();
      }, 2 * MINUTE);
    });
  })
})