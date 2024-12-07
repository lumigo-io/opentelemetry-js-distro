const { createClient } = require('redis');
const http = require('http');
const url = require('url');
require('log-timestamp');

const DEFAULT_REDIS_HOST = 'localhost';
const DEFAULT_REDIS_PORT = 6379;

// If the redis connection is lost, try to reconnect up to this many times
const MAX_REDIS_RECONNECT_RETRIES = 10;
// Between redis reconnect attempts, wait this many milliseconds
const REDIS_WAIT_BETWEEN_RECONNECTS_MS = 1000;

const host = 'localhost';
let httpServer;

async function openRedisConnection(host, port) {
  const client = createClient({
    socket: {
      host,
      port,
      reconnectStrategy: (retries, cause) => {
        console.log(`Connection to Redis lost`);
        if (retries > MAX_REDIS_RECONNECT_RETRIES) {
          console.warn(`Reconnecting to Redis retried ${retries} times, giving up`);
          return new Error(`Too many redis reconnect attempts (${retries}) due to ${cause}`);
        }

        console.warn(`Reconnecting to Redis after ${retries} retries due to ${cause}`);
        return REDIS_WAIT_BETWEEN_RECONNECTS_MS;
      },
    },
    disableOfflineQueue: true,
  });

  // all events must be listened to prevent "Socket Closed Unexpectedly" errors
  client.on('error', (err) => console.error('Redis Client Error', err));
  client.on('connect', () => console.log('Redis Client is connecting'));
  client.on('reconnecting', () => console.log('Redis Client is reconnecting'));
  client.on('ready', () => console.log('Redis Client is ready'));

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
  const key = requestUrl?.query?.key || 'test:key:default';
  const field = requestUrl?.query?.field || 'test:field:default';
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

    case '/hset':
      try {
        client = await openRedisConnection(host, port);
        await client.hSet(key, field, value);
        respond(res, 200, {});
      } catch (err) {
        console.error(`Error setting hash field value`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/hmset':
      try {
        client = await openRedisConnection(host, port);
        const obj = {
          [requestUrl?.query?.fieldA]: requestUrl?.query?.valueA,
          [requestUrl?.query?.fieldB]: requestUrl?.query?.valueB,
        };
        await client.hSet(key, [...Object.entries(obj).flat()]);
        respond(res, 200, {});
      } catch (err) {
        console.error(`Error setting hash field values`, err);
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

    case '/hgetall':
      try {
        client = await openRedisConnection(host, port);
        await client.hGetAll(key);
        respond(res, 200, {});
      } catch (err) {
        console.error(`Error getting key value`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/transaction-set-and-get':
      try {
        client = await openRedisConnection(host, port);
        const preKeyValue = `pre-${value}`;
        const unknownKey = `unknown-${key}`;
        const [setPreKeyReply, getPreKeyValue, setKeyReply, getKeyValue, getUnknownKeyValue] =
          await client
            .multi()
            .set(key, preKeyValue)
            .get(key)
            .set(key, value)
            .get(key)
            .get(unknownKey)
            .exec();
        if (setPreKeyReply != 'OK') {
          throw new Error(`Set pre-key failed with response '${setPreKeyReply}'`);
        }
        if (getPreKeyValue != preKeyValue) {
          throw new Error(
            `Get pre-key value returned '${getPreKeyValue}' when '${preKeyValue}' was expected`
          );
        }
        if (setKeyReply != 'OK') {
          throw new Error(`Set key reply failed with response '${setKeyReply}'`);
        }
        if (getKeyValue != value) {
          throw new Error(`Get key value returned '${getKeyValue}' when '${value}' was expected`);
        }
        if (getUnknownKeyValue) {
          throw new Error(`Unexpected value '${getUnknownKeyValue}' for unknown key`);
        }
        respond(res, 200, {});
      } catch (err) {
        console.error(`Error in transaction`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/info':
      try {
        client = await openRedisConnection(host, port);
        const infoData = await client.info();
        // infoData is a multi-line string. You may wish to parse or just return as-is.
        respond(res, 200, { info: infoData });
      } catch (err) {
        console.error(`Error retrieving info`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/quit':
      console.error('Received quit command');
      respond(res, 200, {});
      httpServer.close();
      break;

    default:
      respond(res, 404, { error: 'Resource not found' });
  }

  if (client) {
    console.log('Closing redis connection');
    await client.quit();
    console.log('Redis connection closed');
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
