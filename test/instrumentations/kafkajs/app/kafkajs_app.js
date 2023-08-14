const { Kafka, CompressionTypes } = require('kafkajs');
const http = require('http');
const url = require('url');
require('log-timestamp');

const DEFAULT_KAFKA_HOST = 'localhost';
const DEFAULT_KAFKA_PORT = 9092;
const MESSAGE_CONSUME_TIMEOUT = 3_000;

const host = 'localhost';
let httpServer;

function waitForMessage(channel, queue, timeoutInMs) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error(`waitForMessage timed out after ${timeoutInMs}ms`);
      channel.close();
      reject(new Error(`Consume error: no message after ${timeoutInMs}ms`));
    }, timeoutInMs);

    await channel.consume(queue, (message) => {
      clearTimeout(timeout);
      let receivedMessage = null;
      if (message !== null) {
        channel.ack(message);
        receivedMessage = message.content.toString();
      }
      resolve(receivedMessage);
      channel.close();
    });
  });
}

async function receiveMessage(conn, queue, expectedMessage) {
  const channel = await conn.createChannel();
  await channel.assertExchange(queue, 'fanout', { durable: false });
  await channel.assertQueue(queue, { durable: false });
  const receivedMessage = await waitForMessage(channel, queue, MESSAGE_CONSUME_TIMEOUT);
  if (receivedMessage != expectedMessage) {
    throw new Error(`Expected message '${expectedMessage}' but received '${receivedMessage}'`);
  }
}

async function sendMessage(conn, queue, message) {
  const channel = await conn.createChannel();
  await channel.assertExchange(queue, 'fanout', { durable: false });
  await channel.assertQueue(queue, { durable: false });
  await channel.sendToQueue(queue, Buffer.from(message));
  await channel.close();
}

function respond(res, status, body) {
  console.log(`responding with ${status} ${JSON.stringify(body)}`);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('access-control-allow-origin', '*');
  res.writeHead(status);
  res.end(JSON.stringify(body));
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
        const producer = kafka.producer({
          allowAutoTopicCreation: true,
        });
        await producer.connect();
        await producer.send({
          topic,
          compression: useCompression ? CompressionTypes.GZIP : CompressionTypes.None,
          messages: [{ key, value: message }],
        });
        await sendMessage(conn, topic, message);
        respond(res, 200, { port });
      } catch (err) {
        respond(res, 500, { error: err });
      }
      break;

    case '/invoke-kafka-consumer':
      try {
        kafka = new Kafka({
          clientId: 'kafkajs_app',
          brokers: [`${host}:${port}`],
        });
        const consumer = kafka.consumer({ groupId: 'consumer-group' });
        await consumer.connect();
        await consumer.subscribe({ topics: [topic], fromBeginning: true });
        const consumerTimeout = setTimeout(async () => {
          await consumer.disconnect();
        }, MESSAGE_CONSUME_TIMEOUT);
        await consumer.run({
          eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
            clearTimeout(consumerTimeout);
            await consumer.disconnect();
            respond(res, 200, { port });
          },
        });
      } catch (err) {
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
