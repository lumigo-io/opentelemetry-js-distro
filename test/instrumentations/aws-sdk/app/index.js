const AWS = require('aws-sdk');
const http = require('http');
const url = require('url');
const axios = require('axios');

require('log-timestamp');

const host = 'localhost';

let appPort;
let sqsPort;
let maxNumberOfMessages;
let sqsClient;
let queueUrl;
let httpServer;

const QUEUE_NAME = `test-queue-${Date.now()}`;

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
    case '/init':
      const { sqsPort: _sqsPort, maxNumberOfMessages: _maxNumberOfMessages } = requestUrl.query

      maxNumberOfMessages = Number(_maxNumberOfMessages)
      sqsPort = Number(_sqsPort)
      sqsClient = new AWS.SQS({ endpoint: `http://localhost:${sqsPort}`, region: 'us-east-1' })
      queueUrl = `http://${host}:${sqsPort}/000000000000/${QUEUE_NAME}`

      await sqsClient.createQueue({ QueueName: QUEUE_NAME }).promise()
      respond(res, 200);
      break;
    case '/sqs/send-message':
      try {
        await sqsClient.sendMessage({
          MessageBody: JSON.stringify({ someValue: Math.random() * 1000 }),
          QueueUrl: queueUrl
        }).promise()
        respond(res, 200, {});
      } catch (err) {
        console.error('Error on sendMessage', err);
        respond(res, 500, { error: err });
      }
      break;
    case '/sqs/receive-message':
      try {
        const totalMessages = [];

        while (totalMessages.length < maxNumberOfMessages) {
          const { Messages: messages } = await sqsClient.receiveMessage({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: maxNumberOfMessages
          }).promise()

          totalMessages.push(...messages)
        }

        await Promise.all(totalMessages.map(async (message, index) => {
          console.log(`Deleting message from queue ${QUEUE_NAME}, ReceiptHandle: ${message.ReceiptHandle}`)
          await sqsClient.deleteMessage({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle }).promise()

          console.log(`Sending an HTTP request with consumed SQS message #${index}: `, JSON.stringify(req.body))
          await axios.post(`http://${host}:${appPort}/some-other-endpoint`, message)
        }));

        respond(res, 200, {});
      } catch (err) {
        console.error('Error on receiveMessage', err);
        respond(res, 500, { error: err });
      }
      break;
    case '/some-other-endpoint':
      console.log('Received an HTTP call following an SQS receiveMessage: ', JSON.stringify(req.body))
      respond(res, 200, req.body);
      break;
    case '/quit':
      console.error('Received quit command');
      respond(res, 200);
      httpServer.close();
      break;
    default:
      respond(res, 404, { error: 'Resource not found' });
  }
};

httpServer = http.createServer(requestListener);

httpServer.listen(0, host, () => {
  appPort = httpServer.address().port;
  console.error(`HTTP server listening on port ${appPort}`);
  if (process.send) {
    process.send(appPort);
  }
});
