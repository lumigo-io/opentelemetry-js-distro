const { sayHello } = require('./greeter_client');
const { GreeterServer } = require('./greeter_server');
const http = require('http');
const url = require('url');
require('log-timestamp');

const APP_TIMEOUT = 10_000;
const DEFAULT_GRPC_PORT = 50051;

const host = 'localhost';
let grpcServer;
let httpServer;
let timeout;

function resetTimeout() {
  if (httpServer) {
    if (timeout) {
      clearTimeout(timeout);
    }
    console.info(`resetting timeout for another ${APP_TIMEOUT}ms...`);
    timeout = setTimeout(async () => {
      console.info(`Shutting down servers after ${APP_TIMEOUT}ms`);
      if (grpcServer) {
        grpcServer.stop();
      }
      httpServer.close();
    }, APP_TIMEOUT);
  }
}

const requestListener = function (req, res) {
  console.error(`Received request: ${req.method} ${req.url}`);
  resetTimeout();

  const requestUrl = url.parse(req.url, true);
  const [port] = requestUrl.query.port || DEFAULT_GRPC_PORT;
  switch (requestUrl.pathname) {
    case '/start-server':
      grpcServer = new GreeterServer(port);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('access-control-allow-origin', '*');
      res.writeHead(200);
      res.end(JSON.stringify({ port: port }));
      break;
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
      break;
    case '/stop-server':
      grpcServer.stop();
      grpcServer = null;
      res.writeHead(200);
      res.end(JSON.stringify('done'));
      break;
    default:
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Resource not found' }));
  }
};

httpServer = http.createServer(requestListener);
console.error(`Starting HTTP server...`);
httpServer.listen(0, host, () => {
  const port = httpServer.address().port;
  console.info(`HTTP server listening on port ${port}`);
  if (process.send) {
    console.error(`Sending port ${port} to parent process...`);
    process.send(port);
  }
});

resetTimeout();
