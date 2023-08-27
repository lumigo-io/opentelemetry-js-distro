const { createClient } = require('redis');
const http = require('http');
const url = require('url');
require('log-timestamp');

const DEFAULT_REDIS_HOST = 'localhost';
const DEFAULT_REDIS_PORT = 6379;

const host = 'localhost';
let httpServer;

async function openRedisConnection(host, port) {
  const client = createClient({
    socket: {
      host,
      port,
      reconnectStrategy: false,
    },
    disableOfflineQueue: true,
  });

  client.on('error', (err) => {
    console.error('Redis Client Error', err);
  });

  await client.connect();

  return client;
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
  const host = requestUrl?.query?.host || DEFAULT_REDIS_HOST;
  const port = Number(requestUrl?.query?.port || DEFAULT_REDIS_PORT);
  const key = requestUrl?.query?.key || 'test:default';
  const value = requestUrl?.query?.value || 'Hello World!';

  let client;
  switch (requestUrl.pathname) {
    case '/set':
      try {
        client = await openRedisConnection(host, port);
        await client.set(key, value);
        respond(res, 200, {});
      } catch (err) {
        console.error(`Error setting key value`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/get':
      try {
        client = await openRedisConnection(host, port);
        const retrievedValue = await client.get(key);
        if (retrievedValue !== value) {
          throw new Error(
            `Retrieved value '${retrievedValue}' does not match expected value '${value}'`
          );
        }
        respond(res, 200, {});
      } catch (err) {
        console.error(`Error getting key value`, err);
        respond(res, 500, { error: err });
      }
      break;

    default:
      respond(res, 404, { error: 'Resource not found' });
  }

  if (client) {
    await client.quit();
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
