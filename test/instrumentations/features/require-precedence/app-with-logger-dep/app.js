const bunyan = require('bunyan');
const http = require('http');

const bunyanLogger = bunyan.createLogger({ name: __filename })

const server = http.createServer(async (req, res) => {
  switch (req.url) {
    case '/write-log':
      bunyanLogger.info('sure thing it works!');
      res.writeHead(200);
      res.end();
      break;
    case '/quit':
      res.writeHead(200);
      res.end('server is quitting');
      server.close();
      break;
      default:
        res.writeHead(404);
        res.end(`route handler for ${req.url} not found`);
        break;
  }
});

server.listen(0, "localhost", () => console.error(`HTTP server listening on port ${server.address().port}`));
