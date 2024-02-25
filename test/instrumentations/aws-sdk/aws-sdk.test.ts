import fs from 'fs';
import { join } from 'path';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import { TestApp } from '../../utils/test-apps';
import AWS from 'aws-sdk';
import 'jest-extended';

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
      const sqsClient = new AWS.SQS({ endpoint: `http://localhost:${sqsPort}`, region: 'us-east-1' })

      const queueName = `test-queue-${Date.now()}`;
      await sqsClient.createQueue({ QueueName: queueName }).promise()

      const queueUrl = `http://localhost:${sqsPort}/000000000000/${queueName}`
      await sqsClient.sendMessage({ MessageBody: 'test me!', QueueUrl: queueUrl }).promise()

      const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}-spans@${versionToTest}.json`;
      const testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile);

      await testApp.invokeGetPath(`/sqs/receive?sqsPort=${sqsPort}&queueUrl=${encodeURIComponent(queueUrl)}`);

      const spans = await testApp.getFinalSpans();
      expect(spans).toSatisfyAny(span => span.attributes?.messageId && span.attributes["http.response.headers"]?.includes(span.attributes?.messageId));

      await testApp.kill();
    }
  )
})