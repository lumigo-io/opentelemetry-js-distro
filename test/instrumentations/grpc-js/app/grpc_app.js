const {
  sayHelloUnaryUnary,
  sayHelloUnaryStream,
  sayHelloStreamUnary,
  sayHelloStreamStream,
} = require('./greeter_client');
const { GreeterServer } = require('./greeter_server');
const http = require('http');
const url = require('url');
require('log-timestamp');

const DEFAULT_GRPC_PORT = 50051;

const host = 'localhost';
let grpcServer;
let httpServer;

function respond(res, status, body) {
  console.log(`responding with ${status} ${JSON.stringify(body)}`);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('access-control-allow-origin', '*');
  res.writeHead(status);
  res.end(JSON.stringify(body));
}

const requestListener = async function (req, res) {
  console.error(`Received request: ${req.method} ${req.url}`);

  const requestUrl = url.parse(req.url, true);
  const name = requestUrl?.query?.name || 'world';
  const port = Number(requestUrl?.query?.port || DEFAULT_GRPC_PORT);
  switch (requestUrl.pathname) {
    case '/start-server':
      grpcServer = new GreeterServer(port);
      await grpcServer.waitUntilReady();
      respond(res, 200, { port });
      break;

    case '/make-unary-unary-request':
      sayHelloUnaryUnary(port, name)
        .then((message) => {
          respond(res, 200, { port, name, response: message });
        })
        .catch((err) => {
          respond(res, 500, { error: err });
        });
      break;

    case '/make-unary-stream-request':
      sayHelloUnaryStream(port, name)
        .then((message) => {
          respond(res, 200, { port, name, response: message });
        })
        .catch((err) => {
          respond(res, 500, { error: err });
        });
      break;

    case '/make-stream-unary-request':
      sayHelloStreamUnary(port, name)
        .then((message) => {
          respond(res, 200, { port, name, response: message });
        })
        .catch((err) => {
          respond(res, 500, { error: err });
        });
      break;

    case '/make-stream-stream-request':
      sayHelloStreamStream(port, name)
        .then((message) => {
          respond(res, 200, { port, name, response: message });
        })
        .catch((err) => {
          respond(res, 500, { error: err });
        });
      break;

    case '/stop-server':
      grpcServer.stop();
      grpcServer = null;
      respond(res, 200, 'done');
      break;

    default:
      respond(res, 404, { error: 'Resource not found' });
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
