import fs from 'fs';
import { join } from 'path';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import { TestApp } from '../../utils/test-apps';
import AWS from 'aws-sdk';
import { Triggers } from '@lumigo/node-core'
import http from 'http';
import 'jest-extended';
import 'jest-json';

const INSTRUMENTATION_NAME = `aws-sdk`;
const SPANS_DIR = join(__dirname, 'spans');
const SQS_STARTUP_TIMEOUT = 60_000;
const TIMEOUT = 600_000;
const TEST_APP_DIR = join(__dirname, 'app');
const LOCALSTACK_PORT = 4566;
const SAMPLE_INNER_SNS_MESSAGE_BODY = JSON.stringify({
  "Type": "Notification",
  "MessageId": "sns-message-message-id-123",
  "TopicArn": "arn:aws:sns:us-west-2:123456789:inner-sns",
  "Message": "{}",
  "Timestamp": "2023-01-15T10:29:01.127Z",
  "SignatureVersion": "1",
  "SigningCertURL": "https://sns.us-west-2.amazonaws.com/SimpleNotificationService-123456789.pem",
  "UnsubscribeURL": "https://sns.us-west-2.amazonaws.com/?Action=Unsubscribe&amp;SubscriptionArn=arn:aws:sns:us-west-2:123456789:inner-sns:123456789"
})

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(`Instrumentation tests for the ${INSTRUMENTATION_NAME} package`, (versionToTest) => {
  let sqsContainer: StartedTestContainer;
  let sqsProxy: http.Server;

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
      const region = 'us-east-1';
      const sqsPort = sqsContainer.getMappedPort(LOCALSTACK_PORT)
      const sqsClient = new AWS.SQS({ endpoint: `http://localhost:${sqsPort}`, region })
      const queueName = `test-queue-${Date.now()}`;
      await sqsClient.createQueue({ QueueName: queueName }).promise()

      const queueUrl = `http://localhost:${sqsPort}/000000000000/${queueName}`

      const { MessageId: expectedMessageId } = await sqsClient.sendMessage({ MessageBody: SAMPLE_INNER_SNS_MESSAGE_BODY, QueueUrl: queueUrl }).promise()

      const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}-spans@${versionToTest}.json`;
      const testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, { "_LUMIGO_AWS_HOST_OVERRIDE": `sqs.${region}.amazonaws.com` });

      await testApp.invokeGetPath(`/sqs/receive?region=${region}&sqsPort=${sqsPort}&queueUrl=${encodeURIComponent(queueUrl)}`);

      const spans = await testApp.getFinalSpans();
      const sqsHttpSpans = spans.filter(span => span.attributes?.messageId)

      // Make sure there are no duplicate spans for the same request from other instrumentations
      expect(sqsHttpSpans).toBeArrayOfSize(1);

      const sqsSpan = sqsHttpSpans[0];
      expect(sqsSpan.attributes['aws.region']).toEqual(region);
      expect(sqsSpan.attributes['aws.resource.name']).toEqual(queueName);
      expect(sqsSpan.attributes['lumigoData']).toMatchJSON({
        trigger: [
          {
            id: expect.any(String),
            targetId: null,
            triggeredBy: Triggers.MessageTrigger.SQS,
            fromMessageIds: [expectedMessageId],
            extra: { resource: queueUrl }
          },
          {
            id: expect.any(String),
            targetId: expect.any(String),
            triggeredBy: Triggers.MessageTrigger.SNS,
            fromMessageIds: ["sns-message-message-id-123"],
            extra: { arn: "arn:aws:sns:us-west-2:123456789:inner-sns" }
          }
        ]
      });
      expect(sqsSpan.attributes['messageId']).toEqual(expectedMessageId);

      await testApp.kill();
    }
  )
})