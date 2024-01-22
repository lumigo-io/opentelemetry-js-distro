import fs from 'fs';
import { join } from 'path';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import { TestApp } from '../../utils/test-apps';
import { times } from 'lodash';
import { SpanKind } from '@opentelemetry/api';
import { getSpanByName, getSpansByKind } from '../../utils/spans';
import 'jest-extended';

const INSTRUMENTATION_NAME = 'aws-sdk';
const SPANS_DIR = join(__dirname, 'spans');
const SQS_STARTUP_TIMEOUT = 60_000;
const TIMEOUT = 600_000;
const TEST_APP_DIR = join(__dirname, 'app');
const LOCALSTACK_PORT = 4566;

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(`Instrumentation tests for the ${INSTRUMENTATION_NAME} package`, (versionToTest) => {
  let sqsContainer: StartedTestContainer;
  let testApp: TestApp;

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

    if (testApp) {
      await testApp.kill();
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

      testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {}, true);
      const messagesToSend = 3;

      await testApp.invokeGetPath(`/init?sqsPort=${sqsPort}&maxNumberOfMessages=${messagesToSend}`);
      await times(messagesToSend, () => testApp.invokeGetPath('/sqs-app/send-message'))
      await testApp.invokeGetPath('/sqs-app/receive-message');

      const filterHttpClientSpans = (spans) => {
        return getSpansByKind(spans, SpanKind.CLIENT).filter(
          (span) => (span.attributes["http.url"] as string)?.endsWith("/some-other-endpoint")
        )
      }

      const finalSpans = await testApp.getFinalSpans(spans => filterHttpClientSpans(spans).length === messagesToSend);

      const awsReceiveMessageConsumerSpans = getSpansByKind(finalSpans, SpanKind.CONSUMER)
      expect(awsReceiveMessageConsumerSpans).toHaveLength(1);

      const internalSpan = getSpanByName(finalSpans, 'receive_child_span')
      expect(internalSpan).toBeDefined()
      expect(internalSpan!.parentId).toBe(awsReceiveMessageConsumerSpans[0].id)
      expect(filterHttpClientSpans(finalSpans)).toSatisfyAll((span) => span.parentId === internalSpan!.id);
    }
  )
})
