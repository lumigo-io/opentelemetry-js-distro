const { GreeterServer } = require('../greeter_server');
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
  if (server) {
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

const requestListener = async function (req, res) {
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
httpServer.listen(0, host, () => {
  const port = httpServer.address().port;
  console.error(`HTTP server listening on port ${port}`);
  if (process.send) {
    process.send(port);
  }
});

resetTimeout();
