const lumigo = require('@lumigo/opentelemetry');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
require('log-timestamp');

let server;
let tracerProvider;

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.get('/test-scrubbing', async (_, res) => {
  res.status(200).send({
    Authorization: 'SECRET',
  });
});

app.get('/', async (_, res) => {
  res.status(200).send('server is ready');
});

app.get('/basic', async (_, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send('Hello world');
});

app.get('/quit', async (_, res) => {
  console.error('Received quit command');
  await tracerProvider.forceFlush();
  res.status(200).send({});
  server.close();
});

server = app.listen(0, async () => {
  tracerProvider = (await lumigo.init).tracerProvider;
  const port = server.address().port;
  console.error(`HTTP server listening on port ${port}`);
  if (process.send) {
    process.send(port);
  }
});
