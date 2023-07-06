require('log-timestamp');

const axios = require('axios');
const http = require('http');
const { trace } = require('@opentelemetry/api');

const APP_TIMEOUT = 10_000;

const host = 'localhost';
const targetUrl = process.env.TARGET_URL;

let server;
let timeout;

function resetTimeout() {
  if (server) {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      console.log(`Shutting down server after ${APP_TIMEOUT}ms`);
      server.close();
    }, APP_TIMEOUT);
  }
}

const requestListener = async function (req, res) {
  switch (req.url) {
    case '/':
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('access-control-allow-origin', '*');
      res.writeHead(200);
      res.end(JSON.stringify('server is ready!'));
      break;
    case '/test1':
      const result = await axios.get(`${targetUrl}/jokes/categories`, {
        headers: {
          header: 'a',
        },
      });
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo', ['bar', 'baz']);
      res.end(JSON.stringify(result.data));
      break;
    case '/large-response':
      const big_result = await axios.put(`${targetUrl}/search`, 'Some very awesome payload', {
        headers: {
          header: 'a',
        },
      });
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo', 'bar');
      trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.date', 1234567);
      res.end(JSON.stringify(big_result.data));
      break;
    case '/test2':
      const dog_res = await axios.get(`${targetUrl}/api/breeds/image/random`, {
        headers: {
          header: 'dog',
        },
      });
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo', 'bar');
      trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.foo', 'foo');
      trace.getActiveSpan()?.setAttribute('lumigo.execution_tags.baz', true);
      res.end(JSON.stringify(dog_res.data));
      break;
    case '/aws-credentials':
      try {
        // We expect this to throw due to the timeout + impossibility to connect
        await axios.get(`${targetUrl}/status/201`, {
          timeout: 5_000, // Milliseconds
        });
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end();
      } catch (err) {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(500);
        res.end(JSON.stringify(err));
      }
      break;
    case '/amazon-sigv4':
      try {
        // We expect this to throw due to the timeout + impossibility to connect
        await axios.post(`${targetUrl}/amazon-sigv4`, '', {
          headers: {
            'x-aMz-cOntEnt-sHa256': 'abcdefghi', // Creative upper-casing, but only marginally less insane than Amazon's :-)
          },
          timeout: 5_000, // Milliseconds
        });
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end();
      } catch (err) {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(500);
        res.end(JSON.stringify(err));
      }
      break;

    default:
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Resource not found' }));
  }
  resetTimeout();
};

server = http.createServer(requestListener);

server.listen(0, host, () => {
  const port = server.address().port;
  console.info('Listening on port ' + port);
  if (process.send) {
    process.send(port);
  }
});

resetTimeout();
