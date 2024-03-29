const {
  SQSClient,
  SendMessageBatchCommand,
  SendMessageCommand,
  ReceiveMessageCommand
} = require('@aws-sdk/client-sqs');
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
  console.log(`Received request: ${req.method} ${req.url} `);

  const requestUrl = url.parse(req.url, true);

  switch (requestUrl.pathname) {
    case '/sqs/receive-message':
      console.log('/sqs/receive endpoint invoked, query-params: ', JSON.stringify(requestUrl.query));
      try {
        sqsClient = new SQSClient({
          endpoint: `http://localhost:${requestUrl.query.sqsPort}`,
          region: requestUrl.query.region,
          credentials: {
            accessKeyId: 'test',
            secretAccessKey: 'test',
            region: requestUrl.query.region
          }
        });
        const receiveMessageCommand = new ReceiveMessageCommand({
          QueueUrl: requestUrl.query.queueUrl,
          MaxNumberOfMessages: 1
        })
        const { Messages } = await sqsClient.send(receiveMessageCommand)

        // Triggers an aws-sdk processing-span
        await Promise.all(Messages.map(() => console.log('processing message!')))
        respond(res, 200, {});
      } catch (err) {
        console.error('Error on ReceiveMessageCommand', err);
        respond(res, 500, { error: err });
      }
      break;
    case '/sqs/send-message':
      console.log('/sqs/send endpoint invoked, query-params: ', JSON.stringify(requestUrl.query));
      try {
        sqsClient = new SQSClient({
          endpoint: `http://localhost:${requestUrl.query.sqsPort}`,
          region: requestUrl.query.region,
          credentials: {
            accessKeyId: 'test',
            secretAccessKey: 'test',
            region: requestUrl.query.region
          }
        });
        const sendMessageCommand = new SendMessageCommand({
          MessageBody: 'some message',
          QueueUrl: requestUrl.query.queueUrl
        })
        await sqsClient.send(sendMessageCommand)
        respond(res, 200, {});
      } catch (err) {
        console.error('Error on SendMessageCommand', err);
        respond(res, 500, { error: err });
      }
      break;
    case '/sqs/send-message-batch':
      console.log('/sqs/send-batch endpoint invoked, query-params: ', JSON.stringify(requestUrl.query));
      try {
        sqsClient = new SQSClient({
          endpoint: `http://localhost:${requestUrl.query.sqsPort}`,
          region: requestUrl.query.region,
          credentials: {
            accessKeyId: 'test',
            secretAccessKey: 'test',
            region: requestUrl.query.region
          }
        });
        const sendMessageBatchCommand = new SendMessageBatchCommand({
          QueueUrl: requestUrl.query.queueUrl,
          Entries: [
            {
              Id: '1',
              MessageBody: 'Message 1 body',
            },
            {
              Id: '2',
              MessageBody: 'Message 2 body',
            },
          ],
        })
        await sqsClient.send(sendMessageBatchCommand)
        respond(res, 200, {});
      } catch (err) {
        console.error('Error on SendMessageBatchCommand', err);
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
