const { Kafka, CompressionTypes } = require('kafkajs');
const http = require('http');
const url = require('url');
require('log-timestamp');

const DEFAULT_KAFKA_HOST = 'localhost';
const DEFAULT_KAFKA_PORT = 9093;
const MESSAGE_CONSUME_TIMEOUT = 3_000;

const host = 'localhost';
let httpServer;

async function sendMessage({ kafka, topic, key, message, useCompression }) {
  const producer = kafka.producer({
    allowAutoTopicCreation: true,
  });
  await producer.connect();
  await producer.send({
    topic,
    compression: useCompression ? CompressionTypes.GZIP : CompressionTypes.None,
    messages: [{ key, value: message }],
  });
  await producer.disconnect();
}

async function receiveMessage({ kafka, topic, expectedMessage }) {
  const consumer = kafka.consumer({ groupId: 'consumer-group' });
  await consumer.connect();
  await consumer.subscribe({ topics: [topic], fromBeginning: true });

  let isTimedOut = false;
  const consumerTimeout = setTimeout(async () => {
    console.error(`Consumer timed out after ${MESSAGE_CONSUME_TIMEOUT}ms`);
    isTimedOut = true;
    await consumer.disconnect();
  }, MESSAGE_CONSUME_TIMEOUT);
  let receivedMessage;
  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      clearTimeout(consumerTimeout);
      receivedMessage = message.value.toString();
      console.error(`Received message: ${receivedMessage}`);
      // commit message
      await consumer.commitOffsets([
        { topic, partition: message.partition, offset: message.offset },
      ]);
      await consumer.disconnect();
    },
  });
  while (!receivedMessage && !isTimedOut) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (receivedMessage != expectedMessage) {
    throw new Error(`Expected message '${expectedMessage}' but received '${receivedMessage}'`);
  }
}

function respond(res, status, body) {
  console.log(`responding with ${status} ${JSON.stringify(body)}`);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('access-control-allow-origin', '*');
  res.writeHead(status);
  res.end(JSON.stringify(body));
}

async function ensureTopicCreated(kafka, topic) {
  const admin = kafka.admin();
  await admin.connect();

  await admin.createTopics({
    waitForLeaders: true,
    topics: [
      {
        topic,
      },
    ],
  });

  await admin.disconnect();
}

const requestListener = async function (req, res) {
  console.error(`Received request: ${req.method} ${req.url}`);

  const requestUrl = url.parse(req.url, true);
  const topic = requestUrl?.query?.topic || 'test-kafkajs-topic';
  const key = requestUrl?.query?.key || 'hello-world';
  const message = requestUrl?.query?.message || 'Hello World!';
  const useCompression = requestUrl?.query?.compression?.toLowerCase() == 'true';
  const host = requestUrl?.query?.host || DEFAULT_KAFKA_HOST;
  const port = requestUrl?.query?.port || DEFAULT_KAFKA_PORT;

  let kafka;
  switch (requestUrl.pathname) {
    case '/invoke-kafka-producer':
      try {
        kafka = new Kafka({
          clientId: 'kafkajs_app',
          brokers: [`${host}:${port}`],
        });
        await ensureTopicCreated(kafka, topic);
        await sendMessage({ kafka, topic, key, message, useCompression });
        respond(res, 200, { port });
      } catch (err) {
        console.error(`Error producing message`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/invoke-kafka-consumer':
      try {
        kafka = new Kafka({
          clientId: 'kafkajs_app',
          brokers: [`${host}:${port}`],
        });
        await ensureTopicCreated(kafka, topic);
        await receiveMessage({ kafka, topic, expectedMessage: message });
        respond(res, 200, { port });
      } catch (err) {
        console.error(`Error consuming message`, err);
        respond(res, 500, { error: err });
      }
      break;

    default:
      respond(res, 404, { error: 'Resource not found' });
  }
};

httpServer = http.createServer(requestListener);
httpServer.listen(0, host, () => {
  const port = httpServer.address().port;
  console.error(`HTTP server listening on port ${port}`);
  if (process.send) {
    process.send(port);
  }
});
