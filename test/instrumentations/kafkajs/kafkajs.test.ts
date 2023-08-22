import { SpanKind } from '@opentelemetry/api';
import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';
import { KafkaContainer, StartedKafkaContainer } from 'testcontainers';
import { itTest } from '../../integration/setup';
import { getSpanByKind } from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { versionsToTest } from '../../utils/versions';
import {
  filterKafkaJsSpans,
  getExpectedResourceAttributes,
  getExpectedSpan,
} from './kafkaJsTestUtils';

const DEFAULT_KAFKA_PORT = 9093;
const DOCKER_START_TIMEOUT = 30_000;
const DOCKER_WARMUP_TIMEOUT = 60_000;
const INSTRUMENTATION_NAME = `kafkajs`;
const SPANS_DIR = join(__dirname, 'spans');
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 600_000;

const startKafkaContainer = async () => {
  return await new KafkaContainer('confluentinc/cp-kafka:latest')
    .withExposedPorts(DEFAULT_KAFKA_PORT)
    .start();
};

describe.each(versionsToTest(INSTRUMENTATION_NAME, INSTRUMENTATION_NAME))(
  `Instrumentation tests for the ${INSTRUMENTATION_NAME} package`,
  function (versionToTest) {
    let testApp: TestApp;
    let kafkaContainer: StartedKafkaContainer;

    beforeAll(async function () {
      reinstallPackages(TEST_APP_DIR);
      fs.mkdirSync(SPANS_DIR, { recursive: true });
      installPackage(TEST_APP_DIR, INSTRUMENTATION_NAME, versionToTest);

      try {
        console.warn(
          `Warming up Kafka container loading, timeout of ${DOCKER_WARMUP_TIMEOUT}ms to account for Docker image pulls...`
        );
        kafkaContainer = await startKafkaContainer();
      } finally {
        if (kafkaContainer) {
          await kafkaContainer.stop();
        }
      }
    }, DOCKER_WARMUP_TIMEOUT);

    beforeEach(async function () {
      kafkaContainer = await startKafkaContainer();

      const host = kafkaContainer.getHost();
      const port = kafkaContainer.getMappedPort(DEFAULT_KAFKA_PORT);

      console.info(`Kafka container started on ${host}:${port}...`);
    }, DOCKER_START_TIMEOUT);

    afterEach(async function () {
      if (testApp) {
        console.info('Killing test app...');
        await testApp.kill();
      } else {
        console.warn('Test app was not run.');
      }
      if (kafkaContainer) {
        console.info('Stopping Kafka container...');
        await kafkaContainer.stop();
      } else {
        console.warn('Kafka container was not started.');
      }
    });

    afterAll(function () {
      uninstallPackage(TEST_APP_DIR, INSTRUMENTATION_NAME, versionToTest);
    });

    itTest(
      {
        testName: `kafka roundtrip: ${versionToTest}`,
        packageName: INSTRUMENTATION_NAME,
        version: versionToTest,
        timeout: TEST_TIMEOUT,
      },
      async function () {
        const exporterFile = `${SPANS_DIR}/kafka-roundtrip.${INSTRUMENTATION_NAME}@${versionToTest}.json`;

        testApp = new TestApp(TEST_APP_DIR, INSTRUMENTATION_NAME, exporterFile, {
          OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT: '4096',
        });

        const topic = 'test-topic-roundtrip';
        const key = 'test-key-roundtrip';
        const message = 'test-message-roundtrip';
        const host = kafkaContainer.getHost();
        const port = kafkaContainer.getMappedPort(DEFAULT_KAFKA_PORT);
        await testApp.invokeGetPath(
          `/invoke-kafka-producer?topic=${topic}&key=${key}&message=${message}&host=${host}&port=${port}`
        );

        await testApp.invokeGetPath(
          `/invoke-kafka-consumer?topic=${topic}&message=${message}&host=${host}&port=${port}`
        );

        const spans = await testApp.getFinalSpans(4);

        const kafkaJsSpans = filterKafkaJsSpans(spans, topic);
        expect(kafkaJsSpans).toHaveLength(2);

        let resourceAttributes = getExpectedResourceAttributes();

        const sendSpan = getSpanByKind(kafkaJsSpans, SpanKind.PRODUCER);
        expect(sendSpan).toMatchObject(
          getExpectedSpan({
            spanKind: SpanKind.PRODUCER,
            resourceAttributes,
            host,
            topic,
            message,
          })
        );

        const receiveSpan = getSpanByKind(kafkaJsSpans, SpanKind.CONSUMER);
        expect(receiveSpan).toMatchObject(
          getExpectedSpan({
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
