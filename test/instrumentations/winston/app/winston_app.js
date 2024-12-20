const http = require('http');
const url = require('url');
const winston = require('winston');

const winstonLogger = winston.createLogger({
  transports: [new winston.transports.Console()],
})

const host = 'localhost';
let httpServer;

function respond(res, status, body) {
  console.log(`responding with ${status} ${JSON.stringify(body)}`);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('access-control-allow-origin', '*');
  res.writeHead(status);
  res.end(JSON.stringify(body));
}

const requestListener = async function (req, res) {
  console.log(`Received request: ${req.method} ${req.url}`);
  const requestUrl = url.parse(req.url, true);

  switch (requestUrl.pathname) {
    case '/write-log-line':
      try {
        const logLine = JSON.parse(requestUrl?.query?.logLine)
        winstonLogger.info(logLine);
        respond(res, 200, {})
      } catch (err) {
        console.error(`Error writing log line`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/quit':
      console.error('Received quit command');
      respond(res, 200, {});
      httpServer.close();
      break;

    default:
      respond(res, 404, { error: 'Resource not found' });
  }
};

httpServer = http.createServer(requestListener);
httpServer.listen(0, host, () => {
  const port = httpServer.address().port;
  console.error(`HTTP server listening on port ${port} `);
  if (process.send) {
    process.send(port);
  }
});
