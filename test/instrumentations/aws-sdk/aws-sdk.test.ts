import fs from 'fs';
import { join } from 'path';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import { TestApp } from '../../utils/test-apps';
import { get, uniq } from 'lodash';

const INSTRUMENTATION_NAME = `aws-sdk`;
const SPANS_DIR = join(__dirname, 'spans');
const SQS_STARTUP_TIMEOUT = 60_000;
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
      .withWaitStrategy(Wait.forLogMessage('Ready.'))
      .withStartupTimeout(SQS_STARTUP_TIMEOUT)
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
    async () => {
      const sqsPort = sqsContainer.getMappedPort(LOCALSTACK_PORT)
      const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}-spans@${versionToTest}.json`;
      const testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile);

      await testApp.invokeGetPath(`/init?sqsPort=${sqsPort}&maxNumberOfMessages=3`)
      await testApp.invokeGetPath('/sqs/send-message')
      await testApp.invokeGetPath('/sqs/send-message')
      await testApp.invokeGetPath('/sqs/send-message')
      await testApp.invokeGetPath('/sqs/receive-message')

      const spans = await testApp.getFinalSpans(12)

      const receiveMessageSpan =  spans.find((span) => {
        const headers = safeJsonParse(span.attributes["http.request.headers"] as string)

        return get(headers, 'user-agent', '').includes('aws-sdk-nodejs') &&
          get(headers, 'x-amz-target') === 'AmazonSQS.ReceiveMessage'
      })
      expect(receiveMessageSpan).toBeDefined()

      const httpCallAfterReceiveSpans = spans.filter((span) =>  {
        return get(span.attributes, "http.url", "").endsWith("/some-other-endpoint")
      })
      expect(httpCallAfterReceiveSpans).toHaveLength(3)

      const httpCallsUniqueParentSpanIds = uniq(httpCallAfterReceiveSpans.map((span) => span.parentId))
      expect(httpCallsUniqueParentSpanIds).toHaveLength(1)

      expect(httpCallAfterReceiveSpans[0].parentId).toBe(receiveMessageSpan!.id)

      await testApp.kill()
    }
  )
})

const safeJsonParse = (spanAttributes: string) => {
  try {
    return JSON.parse(spanAttributes);
  } catch (e) {
    return {};
  }
}
