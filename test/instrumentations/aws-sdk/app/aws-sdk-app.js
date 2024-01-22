const AWS = require('aws-sdk');
const http = require('http');
const url = require('url');
const axios = require('axios');
const { init: lumigoInit, SQS_RECEIVE_SPAN_KEY } = require('@lumigo/opentelemetry');
const { context, trace } = require('@opentelemetry/api');
const pRetry = require('p-retry');

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
  const { tracerProvider } = await lumigoInit;
  const tracer = tracerProvider.getTracer(__filename);

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
    case '/sqs-app/send-message':
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
    case '/sqs-app/receive-message':
      try {
        await pRetry(async () => {
          const { Attributes: { ApproximateNumberOfMessages } }
            = await sqsClient.getQueueAttributes({ QueueUrl: queueUrl, AttributeNames: ["ApproximateNumberOfMessages"] }).promise()

          if (Number(ApproximateNumberOfMessages) !== maxNumberOfMessages) {
            throw new Error(`Expecting ${maxNumberOfMessages} messages, but got ${ApproximateNumberOfMessages}`)
          }
        }, { retries: 5, onFailedAttempt: err => console.error(err) });

        const response = await sqsClient.receiveMessage({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: maxNumberOfMessages,
          WaitTimeSeconds: 0
        }).promise()

        context.with(trace.setSpan(context.active(), response[SQS_RECEIVE_SPAN_KEY]), async () => {
          tracer.startActiveSpan('receive_child_span', async internalSpan => {
            for (const message of response.Messages) {
              internalSpan.setAttribute('lumigo.execution_tags.my_queue_name', QUEUE_NAME);
              internalSpan.setAttribute('lumigo.execution_tags.my_queue_message_count', response.Messages.length);
              await axios.post(`http://${host}:${appPort}/some-other-endpoint`, message)
            }
            internalSpan.end()
          })
        })

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
