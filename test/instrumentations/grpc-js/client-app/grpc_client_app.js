const { sayHello } = require('../greeter_client');
const http = require('http');
const url = require('url');
require('log-timestamp');

const APP_TIMEOUT = 10_000;
const DEFAULT_GRPC_PORT = 50051;

const host = 'localhost';
let httpServer;
let timeout;

function resetTimeout() {
  if (server) {
    if (timeout) {
      clearTimeout(timeout);
    }
    console.info(`resetting timeout for another ${APP_TIMEOUT}ms...`);
    timeout = setTimeout(async () => {
      console.info(`Shutting down servers after ${APP_TIMEOUT}ms`);
      httpServer.close();
    }, APP_TIMEOUT);
  }
}

const requestListener = async function (req, res) {
  resetTimeout();

  const requestUrl = url.parse(req.url, true);
  const [port] = requestUrl.query.port || DEFAULT_GRPC_PORT;
  switch (requestUrl.pathname) {
    case '/make-client-request':
      let name = requestUrl.query.name || 'world';
      sayHello(port, name)
        .then((message) => {
          res.writeHead(200);
          res.end(JSON.stringify({ port: port, name: name, response: message }));
        })
        .catch((err) => {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err }));
        });
    default:
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Resource not found' }));
  }
};

httpServer = http.createServer(requestListener);
httpServer.listen(0, host, () => {
  const port = httpServer.address().port;
  console.error(`HTTP server listening on port ${port}`);
  if (process.send) {
    process.send(port);
  }
});

resetTimeout();
