const lumigo = require('@lumigo/opentelemetry');
const fastify = require('fastify')({ logger: true });
const bunyan = require('bunyan');
const bunyanLogger = bunyan.createLogger({ name: __filename })

let tracerProvider;
let loggerProvider;

fastify.get('/', async (request, reply) => reply.send('server is ready'));

fastify.get('/quit', async (request, reply) => {
  bunyanLogger.info('this should not be exported to Lumigo');

  console.log('Received quit command, flushing and exiting');
  await tracerProvider.forceFlush();
  await loggerProvider.forceFlush();

  // we could have used fastify.close(), but it just takes too long
  reply.send({}).then(() => process.exit(0))
});

fastify.listen({ port: 0 }, async (err, address) => {
  if (err) {
    throw err;
  }
  const lumigoSdk = await lumigo.init
  tracerProvider = lumigoSdk.tracerProvider;
  loggerProvider = lumigoSdk.loggerProvider;
  const port = fastify.server.address().port;
  console.error(`HTTP server listening on port ${port}`);
});
