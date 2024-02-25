const AWS = require('aws-sdk');
const http = require('http');
const url = require('url');

require('log-timestamp');

let appPort;
let httpServer;

function respond(res, status, body = {}) {
  console.log(`responding with ${status} ${JSON.stringify(body)} `);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('access-control-allow-origin', '*');
  res.writeHead(status);
  res.end(JSON.stringify(body));
}

const requestListener = async function (req, res) {
  console.error(`Received request: ${req.method} ${req.url} `);

  const requestUrl = url.parse(req.url, true);

  switch (requestUrl.pathname) {
    case '/sqs/receive':
      console.error('/sqs/receive endpoint invoked, query-params: ', JSON.stringify(requestUrl.query));
      try {
        sqsClient = new AWS.SQS({ endpoint: `http://localhost:${requestUrl.query.sqsPort}`, region: 'us-east-1' })
        const { Messages: messages } = await sqsClient.receiveMessage({
          QueueUrl: requestUrl.query.queueUrl,
          MaxNumberOfMessages: 1
        }).promise()
        respond(res, 200, { messages });
      } catch (err) {
        console.error('Error on receiveMessage', err);
        respond(res, 500, { error: err });
      }
      break;
    case '/quit':
      console.error('/quit endpoint invoked, shutting down...');
      respond(res, 200);
      httpServer.close();
      break;
    default:
      respond(res, 404, { error: 'Resource not found' });
  }
};

httpServer = http.createServer(requestListener);

httpServer.listen(0, 'localhost', () => {
  appPort = httpServer.address().port;
  console.error(`HTTP server listening on port ${appPort}`);
  if (process.send) {
    process.send(appPort);
  }
});
