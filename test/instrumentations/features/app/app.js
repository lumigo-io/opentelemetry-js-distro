const fastify = require('fastify')({ logger: true });
const bunyan = require('bunyan');
const bunyanLogger = bunyan.createLogger({ name: __filename })

let tracerProvider;
let loggerProvider;

fastify.get('/', async (request, reply) => {
  const lumigo = require('@lumigo/opentelemetry');
  const lumigoSdk = await lumigo.init
  tracerProvider = lumigoSdk.tracerProvider;
  loggerProvider = lumigoSdk.loggerProvider;
  reply.send('init: all good')
});

fastify.get('/no-init', async (request, reply) => {
  bunyanLogger.info('this log should be exported to Lumigo without init');
  reply.send('no-init: all good')
});


fastify.get('/quit', async (request, reply) => {
  bunyanLogger.info('this should not be exported to Lumigo');

  console.log('Received quit command, flushing and exiting');
  tracerProvider && await tracerProvider.forceFlush();
  loggerProvider && await loggerProvider.forceFlush();

  // we could have used fastify.close(), but it just takes too long
  reply.send({}).then(() => process.exit(0))
});

fastify.listen({ port: 0 }, async (err, address) => {
  if (err) {
    throw err;
  }
  const port = fastify.server.address().port;
  console.error(`HTTP server listening on port ${port}`);
});
