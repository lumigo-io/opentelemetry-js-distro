const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
require('log-timestamp');

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.get('/', async (req, res) => {
  res.send("server is ready").status(200);
});

app.get('/invoke-requests', async (req, res) => {
  const response = await axios.get('https://api.chucknorris.io/jokes/categories', {
    headers: {
      header: 'a',
    },
  });
  res.send(response.data).status(200);
});

const server = app.listen(0, () => {
  const port = server.address().port;
  console.info('Listening on port ' + port);
  if (process.send) {
    process.send(port);
  }
});