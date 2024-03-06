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
const INSTRUMENTATION_NAME = `nestjs`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 600_000;

const NEST_JS_CREATE = 'Create Nest App';
const NEST_JS_INTERNAL = 'getHello';


describe.each(versionsToTest('@nestjs/core', '@nestjs/core'))(
  'Instrumentation tests for the @nestjs/core package',
    function (versionToTest) {
        let testApp: TestApp;

        beforeAll(async function() {
            reinstallPackages({ appDir: TEST_APP_DIR });

            mkdirSync(SPANS_DIR, { recursive: true });
        }, DOCKER_WARMUP_TIMEOUT);

        beforeEach(async function() {
            installPackage({
                appDir: TEST_APP_DIR,
                packageName: '@nestjs/core',
                packageVersion: versionToTest,
            });
            execSync('npm run build');
            const port = await getPortFree();
            console.log("assigning port ", port);

            testApp = new TestApp(
              TEST_APP_DIR,
              INSTRUMENTATION_NAME,
              `${SPANS_DIR}/basic-@${versionToTest}.json`,
              {
                  NEST_JS_PORT: port,
                  OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
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
                packageName: '@nestjs/core',
                packageVersion: versionToTest,
            });
        });

        itTest(
      {
        testName: `nestjs: ${versionToTest}`,
        packageName: '@nestjs/core',
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
          await testApp.invokeGetPath(`/`);
          const spans = await testApp.getFinalSpans(6);
          expect(spans).toHaveLength(6);

          const createSpan = getSpanByName(spans, NEST_JS_CREATE);
          expect(createSpan.attributes["nestjs.type"]).toEqual("app_creation");
          expect(createSpan.attributes["nestjs.version"]).toEqual(versionToTest);
          expect(createSpan.attributes["nestjs.module"]).toEqual("AppModule");

          const nestJsInternal = getSpanByName(spans, NEST_JS_INTERNAL);
          expect(nestJsInternal.kind).toEqual(SpanKind.INTERNAL);
          expect(nestJsInternal.attributes["nestjs.type"]).toEqual("handler");
          expect(nestJsInternal.attributes["nestjs.version"]).toEqual(versionToTest);
          expect(nestJsInternal.attributes["nestjs.callback"]).toEqual("getHello");
      });
    }
);