import * as fs from 'fs';
import 'jest-expect-message';
import 'jest-json';
import { join } from 'path';

import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

import { itTest } from '../../integration/setup';
import { readSpanDump } from '../../utils/spans';
import { TestApp } from '../../utils/test-apps';
import { installPackage, reinstallPackages, uninstallPackage } from '../../utils/test-setup';
import { sleep } from '../../utils/time';
import { versionsToTest } from '../../utils/versions';

const DEFAULT_RABBITMQ_PORT = 5672;
const INSTRUMENTATION_NAME = `amqplib`;
const SPANS_DIR = join(__dirname, 'spans');
const STARTUP_TIMEOUT = 30_000;
const TEST_APP_DIR = join(__dirname, 'app');
const TEST_TIMEOUT = 30_000;

const expectedResourceAttributes = {
  attributes: {
    framework: 'express',
    'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
    'process.environ': expect.any(String),
    'process.executable.name': 'node',
    'process.pid': expect.any(Number),
    'process.runtime.name': 'nodejs',
    'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
    'service.name': 'express',
    'telemetry.sdk.language': 'nodejs',
    'telemetry.sdk.name': 'opentelemetry',
    'telemetry.sdk.version': expect.any(String),
  },
};

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

        const topic = 'test-topic-basics';
        const message = 'test-message-basics';
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
        while (spans.length < 2) {
          await sleep(1_000);
          spans = readSpanDump(exporterFile);
        }

        // expect(spans, `More than 1 span! ${JSON.stringify(spans)}`).toHaveLength(1); // See #174
        /*expect(getSpanByKind(spans, SpanKind.INTERNAL)).toMatchObject({
          traceId: expect.any(String),
          parentId: expect.any(String),
          name: 'GET /basic',
          id: expect.any(String),
          kind: SpanKind.INTERNAL,
          timestamp: expect.any(Number),
          duration: expect.any(Number),
          resource: expectedResourceAttributes,
          attributes: {
            'http.method': 'GET',
            'http.target': '/basic',
            'http.flavor': '1.1',
            'http.host': expect.stringMatching(/localhost:\d+/),
            'http.scheme': 'http',
            'net.peer.ip': expect.any(String),
            'http.request.query': '{}',
            'http.request.headers': expect.stringMatching(/\{.*\}/),
            'http.response.headers': expect.stringMatching(/\{.*\}/),
            'http.response.body': '"Hello world"',
            'http.route': '/basic',
            'express.route.full': '/basic',
            'express.route.configured': '/basic',
            'express.route.params': '{}',
            'http.status_code': 200,
          },
          status: {
            code: 1,
          },
          events: [],
        });*/
      }
    );
  }
);
