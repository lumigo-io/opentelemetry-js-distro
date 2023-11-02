const lumigo = require('@lumigo/opentelemetry');
const fastify = require('fastify')({
  logger: true,
});

require('log-timestamp');

let tracerProvider;

fastify.get('/test-scrubbing', async (request, reply) => {
  reply.send({
    Authorization: 'SECRET',
  });
});

fastify.get('/', async (request, reply) => {
  reply.send('server is ready');
});

fastify.get('/basic', async (request, reply) => {
  reply.header('Content-Type', 'text/plain').send('Hello world');
});

fastify.post('/echo', async (request, reply) => {
  reply
    .header('Content-Type', 'text/plain')
    .send(typeof request.body === 'string' ? request.body : JSON.stringify(request.body));
});

fastify.get('/quit', async (request, reply) => {
  console.error('Received quit command');
  await tracerProvider.forceFlush();
  reply.send({}).then(async () => {
    // fastify.close() takes too long to do its thing
    process.exit(0);
  });
});

fastify.listen({ port: 0 }, async (err, address) => {
  if (err) throw err;
  tracerProvider = (await lumigo.init).tracerProvider;
  const port = fastify.server.address().port;
  console.error(`HTTP server listening on port ${port}`);
  if (process.send) {
    process.send(port);
  }
});
