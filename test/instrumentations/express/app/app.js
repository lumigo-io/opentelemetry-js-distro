require('@lumigo/opentelemetry');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
require('log-timestamp');

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.get('/test-scrubbing', async (_, res) => {
  res.status(200).send({
    "Authorization": "SECRET"
  });
});

app.get('/', async (_, res) => {
  res.status(200).send("server is ready");
});

app.get('/basic', async (_, res) => {
  res.setHeader('contenty-type', 'text/plain').status(200).send('Hello world');
});

const server = app.listen(0, () => {
  const port = server.address().port;
  console.info('Listening on port ' + port);
  if (process.send) {
    process.send(port);
  }
});
