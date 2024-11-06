import { fastify as createFastify } from 'fastify';
import type { FastifyInstance } from 'fastify';
import * as bunyan from 'bunyan';
import lumigoSdk from '@lumigo/opentelemetry/sync';

const bunyanLogger = bunyan.createLogger({ name: __filename })
const assert = require('assert');

let tracerProvider;
let loggerProvider;

const fastify: FastifyInstance = createFastify({ logger: true });

fastify.get('/sync-init', async (request, reply) => {
  assert(typeof lumigoSdk == "object", 'the default export from the sync entrypoint is not an object!');
  assert(typeof lumigoSdk.tracerProvider == "object", `lumigoSdk.tracerProvider is not an object! (${typeof lumigoSdk.tracerProvider})`);
  assert(typeof lumigoSdk.loggerProvider == "object", `lumigo.default.loggerProvider is not an object! (${typeof lumigoSdk.loggerProvider})`);
  bunyanLogger.info('this log should be exported to Lumigo without init');
  reply.send('sync-init: all good')
});


fastify.get('/quit', async (request, reply) => {
  bunyanLogger.info('this should not be exported to Lumigo');

  console.log('Received quit command, flushing and exiting');
  tracerProvider && await tracerProvider.forceFlush();
  loggerProvider && await loggerProvider.forceFlush();

  // we could have used fastify.close(), but it just takes too long
  reply.send({}).then(() => process.exit(0), (err) => {
    console.error('Failed to send response', err);
    process.exit(1)
  });
});

fastify.listen({ port: 0 }, async (err, address) => {
  if (err) {
    throw err;
  }
  const port = address.split(':').pop();
  console.error(`HTTP server listening on port ${port}`);
});
