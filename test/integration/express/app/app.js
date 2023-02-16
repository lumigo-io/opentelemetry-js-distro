const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
require('log-timestamp');

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.get('/test-scrubbing', async (req, res) => {
  res.send({
    "Authorization": "SECRET"
  }, 200);
});

app.get('/', async (req, res) => {
  res.send("server is ready").status(200);
});

app.get('/basic', async (req, res) => {
  res.send('Hello world').status(200);
});

const server = app.listen(0, () => {
  const port = server.address().port;
  console.info('Listening on port ' + port);
  if (process.send) {
    process.send(port);
  }
});
