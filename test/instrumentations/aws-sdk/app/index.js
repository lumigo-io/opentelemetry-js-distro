const AWS = require('aws-sdk');
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

  const client = new AWS.SQS({ endpoint: 'http://localhost:4566', region: 'us-east-1' })

  switch (requestUrl.pathname) {
    case '/sqs/create-queue':
      try {
        await client.createQueue({ QueueName: 'localstack-queue' }).promise()
        respond(res, 200, {});
      } catch (err) {
        console.error('Error on createQueue', err);
        respond(res, 500, { error: err });
      }
      break;
    case '/sqs/send-message':
      try {
        await client.sendMessage({
          MessageBody: JSON.stringify({ a: 1, b: 2 }),
          QueueUrl: 'http://localhost:4566/000000000000/localstack-queue'
        }).promise()
        respond(res, 200, {});
      } catch (err) {
        console.error('Error on sendMessage', err);
        respond(res, 500, { error: err });
      }
      break;
    case '/sqs/receive-message':
      try {
        await client.receiveMessage({
          QueueUrl: 'http://localhost:4566/000000000000/localstack-queue'
        }).promise()
        respond(res, 200, {});
      } catch (err) {
        console.error('Error on receiveMessage', err);
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
