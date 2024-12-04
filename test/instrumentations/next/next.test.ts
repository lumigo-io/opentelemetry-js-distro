import { execSync } from 'child_process';
import { versionsToTest } from '../../utils/versions';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { itTest } from '../../integration/setup';
import { getSpanByName } from '../../utils/spans';
import { SpanKind } from '@opentelemetry/api';
const net = require('net');


async function getPortFree() {
    return new Promise( res => {
        const srv = net.createServer();
        srv.listen(0, () => {
            const port = srv.address().port
            srv.close((err) => res(port))
        });
    })
}

const DOCKER_WARMUP_TIMEOUT = 120_000;
const INSTRUMENTATION_NAME = `next`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 600_000;

const NEXT_CREATE = 'build component tree';
const NEXT_INTERNAL = 'render route (app) /';


describeVersions(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME)(
  'Instrumentation tests for the next package',
    function (versionToTest) {
        let testApp: TestApp;

        beforeAll(async function() {
            reinstallPackages({ appDir: TEST_APP_DIR });

            mkdirSync(SPANS_DIR, { recursive: true });
        }, DOCKER_WARMUP_TIMEOUT);

        beforeEach(async function() {
            installPackage({
                appDir: TEST_APP_DIR,
                packageName: 'next',
                packageVersion: versionToTest,
            });
            execSync('npm run build');
            const port = await getPortFree();
            console.log("assigning port ", port);

            testApp = new TestApp(
              TEST_APP_DIR,
              INSTRUMENTATION_NAME,
              {
                  spanDumpPath: `${SPANS_DIR}/basic-@${versionToTest}.json`,
                  env: {
                    PORT: String(port),
                    OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
                  }
              }
            );
        }, DOCKER_WARMUP_TIMEOUT);

        afterEach(async function() {
            try {
                await testApp.kill();
            } catch (err) {
                console.warn('Failed to kill test app', err);
            }

            uninstallPackage({
                appDir: TEST_APP_DIR,
                packageName: 'next',
                packageVersion: versionToTest,
            });
        });

        itTest(
      {
        testName: `next: ${versionToTest}`,
        packageName: 'next',
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
          await testApp.invokeGetPath(`/`);
          const spans = await testApp.getFinalSpans(9);
          expect(spans).toHaveLength(9);

          const createSpan = getSpanByName(spans, NEXT_CREATE);
          expect(createSpan.attributes["next.span_type"]).toEqual("NextNodeServer.createComponentTree");
          //
          const nextInternal = getSpanByName(spans, NEXT_INTERNAL);
          expect(nextInternal.kind).toEqual(SpanKind.INTERNAL);
          expect(nextInternal.attributes["next.span_type"]).toEqual("AppRender.getBodyResult");
      });
    }
);