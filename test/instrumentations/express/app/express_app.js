require('@lumigo/opentelemetry');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
require('log-timestamp');

const APP_TIMEOUT = 10_000;

let server;
let timeout;

function resetTimeout() {
  if (server) {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      console.error(`Shutting down server after ${APP_TIMEOUT}ms`);
      server.close();
    }, APP_TIMEOUT);
  }
}

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.get('/test-scrubbing', async (_, res) => {
  res.status(200).send({
    Authorization: 'SECRET',
  });
  resetTimeout();
});

app.get('/', async (_, res) => {
  res.status(200).send('server is ready');
  resetTimeout();
});

app.get('/basic', async (_, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send('Hello world');
  resetTimeout();
});

server = app.listen(0, () => {
  const port = server.address().port;
  console.error(`HTTP server listening on port ${port}`);
  if (process.send) {
    process.send(port);
  }
});

resetTimeout();
