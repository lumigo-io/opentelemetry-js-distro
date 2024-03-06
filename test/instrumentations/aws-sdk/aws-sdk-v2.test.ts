import fs from 'fs';
import { join } from 'path';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import { TestApp } from '../../utils/test-apps';
import AWS from 'aws-sdk';
import { Triggers } from '@lumigo/node-core'
import 'jest-extended';
import 'jest-json';
import {getSpansByAttribute} from '../../utils/spans';

const INSTRUMENTATION_NAME = 'aws-sdk';
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
  let testApp: TestApp;
  let sqsPort: number;
  let sqsClient: AWS.SQS;
  const region = 'us-east-1';

  beforeAll(async () => {
    fs.mkdirSync(SPANS_DIR, { recursive: true });

    sqsContainer = await new GenericContainer('localstack/localstack:latest')
      .withEnv('SERVICES', 'sqs')
      .withExposedPorts(LOCALSTACK_PORT)
      .withWaitStrategy(Wait.forLogMessage('Ready.'))
      .withStartupTimeout(SQS_STARTUP_TIMEOUT)
      .start();

    sqsPort = sqsContainer.getMappedPort(LOCALSTACK_PORT)
    sqsClient = new AWS.SQS({ endpoint: `http://localhost:${sqsPort}`, region })

    reinstallPackages({ appDir: TEST_APP_DIR })
    installPackage({
      appDir: TEST_APP_DIR,
      packageName: INSTRUMENTATION_NAME,
      packageVersion: versionToTest
    });
  }, TIMEOUT)

  afterAll(async () => {
    if (testApp) {
      await testApp.kill();
    }

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
      testName: `${INSTRUMENTATION_NAME} SQS.receiveMessage: ${versionToTest}`,
      packageName: INSTRUMENTATION_NAME,
      version: versionToTest,
      timeout: TIMEOUT,
    },
    async () => {
      const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}-receive-message-spans@${versionToTest}.json`;

      const { queueUrl, queueName } = await createTempQueue();
      const { MessageId: expectedMessageId } = await sqsClient.sendMessage({ MessageBody: SAMPLE_INNER_SNS_MESSAGE_BODY, QueueUrl: queueUrl }).promise()

      testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile);

      await testApp.invokeGetPath(`/sqs/receive-message?${testAppQueryParams(queueUrl)}`);

      const spans = await testApp.getFinalSpans();
      const sqsSpans = getSpansByAttribute(spans, "rpc.service", "SQS")
      const sqsReceiveSpan = getSpansByAttribute(sqsSpans, "rpc.method", "ReceiveMessage")[0]

      // Fields that are implicitly set by the aws-sdk instrumentation
      expect(sqsReceiveSpan.attributes['aws.region']).toEqual(region);
      expect(sqsReceiveSpan.attributes['messaging.system']).toBe('aws.sqs')
      expect(sqsReceiveSpan.attributes['messaging.url']).toBe(queueUrl)

      // Fields we explicitly set in our instrumentation wrapper
      expect(sqsReceiveSpan.attributes['aws.resource.name']).toEqual(queueUrl);
      expect(sqsReceiveSpan.attributes['messageId']).toEqual(expectedMessageId);
      expect(sqsReceiveSpan.attributes['messaging.operation']).toEqual('ReceiveMessage')
      expect(sqsReceiveSpan.attributes['aws.queue.name']).toEqual(queueName)
      expect(sqsReceiveSpan.attributes['messaging.publish.body']).toBeUndefined()
      expect(sqsReceiveSpan.attributes['messaging.consume.body']).toMatchJSON({
        Messages: [{
          Body: SAMPLE_INNER_SNS_MESSAGE_BODY,
          MD5OfBody: expect.any(String),
          MessageId: expectedMessageId,
          ReceiptHandle: expect.any(String)
        }]
      })
      expect(sqsReceiveSpan.attributes['lumigoData']).toMatchJSON({
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
    }
  )

  itTest(
    {
      testName: `${INSTRUMENTATION_NAME} SQS.sendMessage: ${versionToTest}`,
      packageName: INSTRUMENTATION_NAME,
      version: versionToTest,
      timeout: TIMEOUT,
    },
    async () => {
      const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}-send-message-spans@${versionToTest}.json`;
      testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile);

      const { queueUrl, queueName } = await createTempQueue();
      await testApp.invokeGetPath(`/sqs/send-message?${testAppQueryParams(queueUrl)}`);

      const { Messages } = await sqsClient.receiveMessage({ QueueUrl: queueUrl, WaitTimeSeconds: 1 }).promise()
      const expectedMessageId = Messages?.[0].MessageId
      expect(expectedMessageId).toBeDefined()

      const spans = await testApp.getFinalSpans();
      const sqsSpans = getSpansByAttribute(spans, "rpc.service", "SQS")
      const sqsSendSpan = getSpansByAttribute(sqsSpans, "rpc.method", "SendMessage")[0]

      // Fields that are implicitly set by the aws-sdk instrumentation
      expect(sqsSendSpan.attributes['aws.region']).toEqual(region);
      expect(sqsSendSpan.attributes['messaging.system']).toBe('aws.sqs')
      expect(sqsSendSpan.attributes['messaging.url']).toBe(queueUrl)

      // Fields we explicitly set in our instrumentation wrapper
      expect(sqsSendSpan.attributes['aws.resource.name']).toEqual(queueUrl);
      expect(sqsSendSpan.attributes['messageId']).toEqual(expectedMessageId);
      expect(sqsSendSpan.attributes['messaging.operation']).toEqual('SendMessage')
      expect(sqsSendSpan.attributes['aws.queue.name']).toEqual(queueName)
      expect(sqsSendSpan.attributes['messaging.consume.body']).toBeUndefined()
      expect(sqsSendSpan.attributes['messaging.publish.body']).toMatchJSON({
        // Message body sent from the test-app
        "MessageBody": "some message",
        "QueueUrl": queueUrl,
      })
      expect(sqsSendSpan.attributes['lumigoData']).toBeUndefined()
    }
  )

  itTest(
    {
      testName: `${INSTRUMENTATION_NAME} SQS.sendMessageBatch: ${versionToTest}`,
      packageName: INSTRUMENTATION_NAME,
      version: versionToTest,
      timeout: TIMEOUT,
    },
    async () => {
      const exporterFile = `${SPANS_DIR}/${INSTRUMENTATION_NAME}-send-message-batch-spans@${versionToTest}.json`;
      testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile);

      const { queueUrl, queueName } = await createTempQueue();
      await testApp.invokeGetPath(`/sqs/send-message-batch?${testAppQueryParams(queueUrl)}`);

      const { Messages } = await sqsClient.receiveMessage({ QueueUrl: queueUrl, WaitTimeSeconds: 1, MaxNumberOfMessages: 2 }).promise()
      const expectedMessageId = Messages?.[0].MessageId
      expect(expectedMessageId).toBeDefined()

      const spans = await testApp.getFinalSpans();
      const sqsSpans = getSpansByAttribute(spans, "rpc.service", "SQS")
      const sqsSendBatchSpan = getSpansByAttribute(sqsSpans, "rpc.method", "SendMessageBatch")[0]

      // Fields that are implicitly set by the aws-sdk instrumentation
      expect(sqsSendBatchSpan.attributes['aws.region']).toEqual(region);
      expect(sqsSendBatchSpan.attributes['messaging.system']).toBe('aws.sqs')
      expect(sqsSendBatchSpan.attributes['messaging.url']).toBe(queueUrl)

      // Fields we explicitly set in our instrumentation wrapper
      expect(sqsSendBatchSpan.attributes['aws.resource.name']).toEqual(queueUrl);
      expect(sqsSendBatchSpan.attributes['messageId']).toEqual(expectedMessageId);
      expect(sqsSendBatchSpan.attributes['messaging.operation']).toEqual('SendMessageBatch')
      expect(sqsSendBatchSpan.attributes['aws.queue.name']).toEqual(queueName)
      expect(sqsSendBatchSpan.attributes['messaging.consume.body']).toBeUndefined()
      expect(sqsSendBatchSpan.attributes['messaging.publish.body']).toMatchJSON({
        // Message bodies sent from the test-app
        "Entries":  [
           {
            "Id": "1",
            "MessageBody": "Message 1 body",
          },
           {
            "Id": "2",
            "MessageBody": "Message 2 body",
          },
        ],
        "QueueUrl": queueUrl,
      })
      expect(sqsSendBatchSpan.attributes).not.toHaveProperty('lumigoData')
    }
  )

  const testAppQueryParams = (queueUrl: string) =>  Object.entries({
    region,
    sqsPort,
    queueUrl: encodeURIComponent(queueUrl)
  }).map(keyValue => keyValue.join('=')).join('&')

  const createTempQueue = async () => {
    const queueName = `test-queue-${Date.now()}`;
    await sqsClient.createQueue({ QueueName: queueName }).promise()
    const queueUrl = `http://localhost:${sqsPort}/000000000000/${queueName}`

    return { queueUrl, queueName }
  }
})