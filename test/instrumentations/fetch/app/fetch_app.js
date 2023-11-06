const http = require('http');
const url = require('url');
require('log-timestamp');

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
  console.error(`Received request: ${req.method} ${req.url}`);

  const requestUrl = url.parse(req.url, true);
  const fetchUrl = requestUrl?.query?.url;
  const messageBody = requestUrl?.query?.messageBody;

  let result;
  switch (requestUrl.pathname) {
    case '/get-json':
      try {
        result = await fetch(fetchUrl);
        console.error(`Received response: ${result.status} ${result.statusText}`);
        console.error(`Response headers:`, result.headers);
        console.error(`Response body:`, await result.json());
        respond(res, 200, {});
      } catch (err) {
        console.error(`Error fetching/printing json result`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/get-text':
      try {
        result = await fetch(fetchUrl);
        console.error(`Received response: ${result.status} ${result.statusText}`);
        console.error(`Response headers:`, result.headers.raw());
        console.error(`Response body:`, await result.text());
        respond(res, 200, {});
      } catch (err) {
        console.error(`Error fetching/printing text result`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/post-json':
      try {
        result = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: messageBody }),
        });
        console.error(`Received response: ${result.status} ${result.statusText}`);
        console.error(`Response headers:`, result.headers.raw());
        console.error(`Response body:`, await result.json());
        respond(res, 200, {});
      } catch (err) {
        console.error(`Error fetching/printing json result`, err);
        respond(res, 500, { error: err });
      }
      break;

    case '/post-text':
      try {
        result = await fetch(fetchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: JSON.stringify({ message: messageBody }),
        });
        console.error(`Received response: ${result.status} ${result.statusText}`);
        console.error(`Response headers:`, result.headers.raw());
        console.error(`Response body:`, await result.text());
        respond(res, 200, {});
      } catch (err) {
        console.error(`Error fetching/printing text result`, err);
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
  console.error(`HTTP server listening on port ${port}`);
  if (process.send) {
    process.send(port);
  }
});
