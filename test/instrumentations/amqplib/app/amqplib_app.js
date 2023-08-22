const amqp = require('amqplib');
const http = require('http');
const url = require('url');
require('log-timestamp');

const DEFAULT_RABBITMQ_HOST = 'localhost';
const DEFAULT_RABBITMQ_PORT = 5672;
const MESSAGE_CONSUME_TIMEOUT = 3000;

const host = 'localhost';
let httpServer;

function waitForMessage(channel, queue, timeoutInMs) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error(`waitForMessage timed out after ${timeoutInMs}ms`);
      channel.close();
      reject(new Error(`Consume error: no message after ${timeoutInMs}ms`));
    }, timeoutInMs);

    await channel.consume(queue, async (message) => {
      clearTimeout(timeout);
      let receivedMessage = null;
      if (message !== null) {
        channel.ack(message);
        // wait for 500ms for ack to persist
        await new Promise((resolve) => setTimeout(resolve, 500));
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
  const topic = requestUrl?.query?.topic || 'test-amqplib-topic';
  const message = requestUrl?.query?.message || 'Hello World!';
  const host = requestUrl?.query?.host || DEFAULT_RABBITMQ_HOST;
  const port = requestUrl?.query?.port || DEFAULT_RABBITMQ_PORT;

  let conn;
  switch (requestUrl.pathname) {
    case '/invoke-amqp-producer':
      try {
        conn = await amqp.connect(`amqp://${host}:${port}`);
        await sendMessage(conn, topic, message);
        respond(res, 200, { port });
      } catch (err) {
        console.error(`Error producing message`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/invoke-amqp-consumer':
      try {
        conn = await amqp.connect(`amqp://${host}:${port}`);
        await receiveMessage(conn, topic, message);
        respond(res, 200, { port });
      } catch (err) {
        console.error(`Error consuming message`, err);
        respond(res, 500, { error: err });
      }
      break;

    default:
      respond(res, 404, { error: 'Resource not found' });
  }

  if (conn) {
    await conn.close();
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
