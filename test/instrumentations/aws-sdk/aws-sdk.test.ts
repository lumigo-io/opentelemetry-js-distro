import fs from 'fs';
import { join } from 'path';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import {TestApp} from '../../utils/test-apps';

const INSTRUMENTATION_NAME = `aws-sdk`;
const SPANS_DIR = join(__dirname, 'spans');
const TIMEOUT = 600_000;
const TEST_APP_DIR = join(__dirname, 'app');
const LOCALSTACK_PORT = 4566;

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(`Instrumentation tests for the ${INSTRUMENTATION_NAME} package`, (versionToTest) => {
  let sqsContainer: StartedTestContainer;

  beforeAll(async () => {
    fs.mkdirSync(SPANS_DIR, { recursive: true });

    sqsContainer = await new GenericContainer('localstack/localstack:latest')
      .withEnv('SERVICES', 'sqs')
      .withExposedPorts(LOCALSTACK_PORT)
      .start();

    reinstallPackages({ appDir: TEST_APP_DIR })
    installPackage({
      appDir: TEST_APP_DIR,
      packageName: INSTRUMENTATION_NAME,
      packageVersion: versionToTest
    });
  }, TIMEOUT)

  afterAll(async () => {
    if (sqsContainer) {
      await sqsContainer.stop()
    }

    uninstallPackage({
      appDir: TEST_APP_DIR,
      packageName: INSTRUMENTATION_NAME,
      packageVersion: versionToTest
    });
  }, TIMEOUT)

  itTest(
    {
      testName: `${INSTRUMENTATION_NAME} set and get: ${versionToTest}`,
      packageName: INSTRUMENTATION_NAME,
      version: versionToTest,
      timeout: TIMEOUT,
    },
    async function () {
      const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}-spans@${versionToTest}.json`;
      const testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile);

      await testApp.invokeGetPath('/sqs/create-queue')
      await testApp.invokeGetPath('/sqs/send-message')
      await testApp.invokeGetPath('/sqs/send-message')
      await testApp.invokeGetPath('/sqs/send-message')
      await testApp.invokeGetPath('/sqs/receive-message')

      // TODO: add assertions
      // const spans = await testApp.getFinalSpans(4)
      // expect(spans).resolves.toHaveLength(4);

      await testApp.kill()
    }
  );
});
