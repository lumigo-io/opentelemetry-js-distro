import { SpanKind } from '@opentelemetry/api';
import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { getSpanByName } from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import {
  filterAmqplibSpans,
  getExpectedResourceAttributes,
  getExpectedSpan,
} from './amqplibTestUtils';

const DEFAULT_RABBITMQ_PORT = 5672;
const DOCKER_WARMUP_TIMEOUT = 30_000;
const INSTRUMENTATION_NAME = `amqplib`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 600_000;

const startRabbitMqContainer = async () => {
  return await new GenericContainer('rabbitmq:latest')
    .withExposedPorts(DEFAULT_RABBITMQ_PORT)
    .withWaitStrategy(Wait.forLogMessage('Server startup complete'))
    .withStartupTimeout(DOCKER_WARMUP_TIMEOUT)
    .start();
};

let warmupState = {
  warmupInitiated: false,
  warmupCompleted: false,
};

const warmupContainer = async () => {
  if (!warmupState.warmupInitiated) {
    warmupState.warmupInitiated = true;
    console.warn(
      `Warming up RabbitMQ container loading, timeout of ${DOCKER_WARMUP_TIMEOUT}ms to account for Docker image pulls...`
    );
    let warmupContainer: StartedTestContainer;
    try {
      warmupContainer = await startRabbitMqContainer();
      await warmupContainer.stop();
    } catch (err) {
      console.warn(`Failed to warmup RabbitMQ container: ${err}`);
    }
    warmupState.warmupCompleted = true;
  } else {
    while (!warmupState.warmupCompleted) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
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

      await warmupContainer();
    }, DOCKER_WARMUP_TIMEOUT);

    beforeEach(async function () {
      rabbitmqContainer = await startRabbitMqContainer();

      const host = rabbitmqContainer.getHost();
      const port = rabbitmqContainer.getMappedPort(DEFAULT_RABBITMQ_PORT);

      console.info(`RabbitMQ container started on ${host}:${port}...`);
    }, 15_000);

    afterEach(async function () {
      if (testApp) {
        console.info('Killing test app...');
        await testApp.kill();
      } else {
        console.warn('Test app was not run.');
      }
      if (rabbitmqContainer) {
        console.info('Stopping RabbitMQ container...');
        await rabbitmqContainer.stop();
      } else {
        console.warn('RabbitMQ container was not started.');
      }
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
        const exporterFile = `${SPANS_DIR}/amqp-roundtrip.${INSTRUMENTATION_NAME}@${versionToTest}.json`;

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

        await testApp.invokeGetPath(
          `/invoke-amqp-consumer?topic=${topic}&message=${message}&host=${host}&port=${port}`
        );

        const spans = await testApp.getFinalSpans(4);

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
            message,
          })
        );
      }
    );
  }
);
