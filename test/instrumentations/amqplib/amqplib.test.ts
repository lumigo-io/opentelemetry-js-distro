import { SpanKind } from '@opentelemetry/api';
import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { getSpanByName, readSpanDump } from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { sleep } from '../../utils/time';
import { versionsToTest } from '../../utils/versions';
import {
  filterAmqplibSpans,
  getExpectedResourceAttributes,
  getExpectedSpan,
} from './amqplibTestUtils';

const DEFAULT_RABBITMQ_PORT = 5672;
const INSTRUMENTATION_NAME = `amqplib`;
const SPANS_DIR = join(__dirname, 'spans');
const STARTUP_TIMEOUT = 30_000;
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 600_000;

const startRabbitMqContainer = async () => {
  return await new GenericContainer('rabbitmq:latest')
    .withExposedPorts(DEFAULT_RABBITMQ_PORT)
    .withWaitStrategy(Wait.forLogMessage('Server startup complete'))
    .withStartupTimeout(STARTUP_TIMEOUT)
    .start();
};

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(
  `Instrumentation tests for the ${INSTRUMENTATION_NAME} package`,
  function (versionToTest) {
    let testApp: TestApp;
    let rabbitmqContainer: StartedTestContainer;

    beforeAll(async function () {
      reinstallPackages(TEST_APP_DIR);
      fs.mkdirSync(SPANS_DIR, { recursive: true });
      installPackage(TEST_APP_DIR, INSTRUMENTATION_NAME, versionToTest);

      /*
       * Warm up container infra, download images, etc.
       * This prevents spurious failures of early tests.
       */
      try {
        rabbitmqContainer = await startRabbitMqContainer();
      } finally {
        if (rabbitmqContainer) {
          rabbitmqContainer.stop();
        }
      }
    }, STARTUP_TIMEOUT /* Long timeout, this might have to pull Docker images */);

    beforeEach(async function () {
      rabbitmqContainer = await startRabbitMqContainer();

      const host = rabbitmqContainer.getHost();
      const port = rabbitmqContainer.getMappedPort(DEFAULT_RABBITMQ_PORT);

      console.info(`RabbitMQ container started on ${host}:${port}...`);
    }, 15_000);

    afterEach(async function () {
      console.info('Killing test app...');
      await testApp.kill();
      await rabbitmqContainer.stop();
    });

    afterAll(function () {
      uninstallPackage(TEST_APP_DIR, INSTRUMENTATION_NAME, versionToTest);
    });

    itTest(
      {
        testName: `amqp roundtrip: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/amqp-roundtrip.amqplib@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });

        const topic = 'test-topic-roundtrip';
        const message = 'test-message-roundtrip';
        const host = rabbitmqContainer.getHost();
        const port = rabbitmqContainer.getMappedPort(DEFAULT_RABBITMQ_PORT);
        await testApp.invokeGetPath(
          `/invoke-amqp-producer?topic=${topic}&message=${message}&host=${host}&port=${port}`
        );

        let spans = await testApp.invokeGetPathAndRetrieveSpanDump(
          `/invoke-amqp-consumer?topic=${topic}&message=${message}&host=${host}&port=${port}`
        );

        /*
         * TODO: HORRIBLE WORKAROUND: The internal span we are looking for seems to be closed LATER than
         * the Server span, so we must busy-poll.
         */
        while (spans.length < 4) {
          await sleep(1_000);
          spans = readSpanDump(exporterFile);
        }

        const amqplibSpans = filterAmqplibSpans(spans, topic);
        expect(amqplibSpans).toHaveLength(2);

        let resourceAttributes = getExpectedResourceAttributes();

        const expectedSendSpanName = `<default> -> ${topic} send`;
        const sendSpan = getSpanByName(amqplibSpans, expectedSendSpanName);
        expect(sendSpan).toMatchObject(
          getExpectedSpan({
            nameSpanAttr: expectedSendSpanName,
            spanKind: SpanKind.PRODUCER,
            resourceAttributes,
            host,
            topic,
            messageKey: 'messaging.publish.body',
            message,
          })
        );

        const expectedReceiveSpanName = `${topic} process`;
        const receiveSpan = getSpanByName(amqplibSpans, expectedReceiveSpanName);
        expect(receiveSpan).toMatchObject(
          getExpectedSpan({
            nameSpanAttr: expectedReceiveSpanName,
            spanKind: SpanKind.CONSUMER,
            resourceAttributes,
            host,
            topic,
            messageKey: 'messaging.consume.body',
            message,
          })
        );
      }
    );
  }
);
