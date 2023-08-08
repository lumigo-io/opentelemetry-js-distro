const amqp = require('amqplib');
const http = require('http');
const url = require('url');
require('log-timestamp');

const DEFAULT_RABBITMQ_HOST = 'localhost';
const DEFAULT_RABBITMQ_PORT = 5672;

const host = 'localhost';
let httpServer;

async function receiveMessage(conn, queue, message) {
  const channel = await conn.createChannel();
  await channel.assertExchange(queue, 'fanout', { durable: false });
  await channel.assertQueue(queue, { durable: false });
  const receivedMessage = await channel.get(queue);
  if (message != receivedMessage.content.toString()) {
    throw new Error(
      `Expected message '${message}' but received '${receivedMessage.content.toString()}'`
    );
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
  const conn = await amqp.connect(`amqp://${host}:${port}`);

  switch (requestUrl.pathname) {
    case '/invoke-amqp-producer':
      try {
        await sendMessage(conn, topic, message);
        respond(res, 200, { port });
      } catch (err) {
        respond(res, 500, { error: err });
      } finally {
        await conn.close();
      }
      break;

    case '/invoke-amqp-consumer':
      try {
        await receiveMessage(conn, topic, message);
        respond(res, 200, { port });
      } catch (err) {
        respond(res, 500, { error: err });
      } finally {
        await conn.close();
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
