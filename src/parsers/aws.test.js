import * as aws from './aws';
import { md5Hash } from '../utils';
import {shouldAutoFilterEmptySqs, shouldSkipSqsSpan} from './aws';

describe('aws parser', () => {
  test('dynamodbParser', () => {
    const resourceName = 'TabulaRasa';

    const headersBad = {};
    const bodyBad = JSON.stringify({});
    const requestDataBad = { headers: headersBad, body: bodyBad };
    const expectedBad = {
      'aws.dynamodb.method': '',
      'aws.resource.name': '',
    };
    expect(aws.dynamodbParser(requestDataBad)).toEqual(expectedBad);

    const bodyGet = JSON.stringify({ TableName: resourceName });
    const headersGet = { 'x-amz-target': 'DynamoDB_20120810.GetItem' };
    const requestDataGet = { headers: headersGet, body: bodyGet };
    const expectedGet = {
      'aws.dynamodb.method': 'GetItem',
      'aws.resource.name': resourceName,
    };
    expect(aws.dynamodbParser(requestDataGet)).toEqual(expectedGet);

    const bodyPut = JSON.stringify({
      TableName: resourceName,
      Item: { key: { S: 'value' } },
    });
    const headersPut = { 'x-amz-target': 'DynamoDB_20120810.PutItem' };
    const requestDataPut = { headers: headersPut, body: bodyPut };
    const expectedPut = {
      'aws.dynamodb.method': 'PutItem',
      'aws.resource.name': resourceName,
      messageId: md5Hash({ key: { S: 'value' } }),
    };
    expect(aws.dynamodbParser(requestDataPut)).toEqual(expectedPut);

    const bodyDelete = JSON.stringify({
      TableName: resourceName,
      Key: { key: { S: 'value' } },
    });
    const headersDelete = { 'x-amz-target': 'DynamoDB_20120810.DeleteItem' };
    const requestDataDelete = { headers: headersDelete, body: bodyDelete };
    const expectedDelete = {
      'aws.dynamodb.method': 'DeleteItem',
      'aws.resource.name': resourceName,
      messageId: md5Hash({ key: { S: 'value' } }),
    };
    expect(aws.dynamodbParser(requestDataDelete)).toEqual(expectedDelete);

    const bodyUpdate = JSON.stringify({
      TableName: resourceName,
      Key: { key: { S: 'value' } },
    });
    const headersUpdate = { 'x-amz-target': 'DynamoDB_20120810.UpdateItem' };
    const requestDataUpdate = { headers: headersUpdate, body: bodyUpdate };
    const expectedUpdate = {
      'aws.dynamodb.method': 'UpdateItem',
      'aws.resource.name': resourceName,
      messageId: md5Hash({ key: { S: 'value' } }),
    };
    expect(aws.dynamodbParser(requestDataUpdate)).toEqual(expectedUpdate);

    const bodyWriteBatch = JSON.stringify({
      RequestItems: {
        [resourceName]: [{ PutRequest: { Item: { key: { S: 'value' } } } }],
      },
    });
    const headersWriteBatch = {
      'x-amz-target': 'DynamoDB_20120810.BatchWriteItem',
    };
    const requestDataWriteBatch = {
      headers: headersWriteBatch,
      body: bodyWriteBatch,
    };
    const expectedWriteBatch = {
      'aws.dynamodb.method': 'BatchWriteItem',
      'aws.resource.name': resourceName,
      messageId: md5Hash({ key: { S: 'value' } }),
    };

    expect(aws.dynamodbParser(requestDataWriteBatch)).toEqual(expectedWriteBatch);

    const bodyGetBatch = JSON.stringify({
      RequestItems: {
        [resourceName]: {
          Keys: [{ key: { S: 'value' } }],
        },
      },
    });
    const headersGetBatch = {
      'x-amz-target': 'DynamoDB_20120810.BatchGetItem',
    };
    const requestDataGetBatch = {
      headers: headersGetBatch,
      body: bodyGetBatch,
    };
    const expectedDataGetBatch = {
      'aws.dynamodb.method': 'BatchGetItem',
      'aws.resource.name': resourceName,
    };
    expect(aws.dynamodbParser(requestDataGetBatch)).toEqual(expectedDataGetBatch);

    const bodyDeleteBatch = JSON.stringify({
      RequestItems: {
        [resourceName]: [{ DeleteRequest: { Key: { key: { S: 'value' } } } }],
      },
    });
    const headersDeleteBatch = {
      'x-amz-target': 'DynamoDB_20120810.BatchWriteItem',
    };
    const requestDataDeleteBatch = {
      headers: headersDeleteBatch,
      body: bodyDeleteBatch,
    };
    const expectedDeleteBatch = {
      'aws.dynamodb.method': 'BatchWriteItem',
      'aws.resource.name': resourceName,
      messageId: md5Hash({ key: { S: 'value' } }),
    };
    expect(aws.dynamodbParser(requestDataDeleteBatch)).toEqual(expectedDeleteBatch);
  });

  test('lambdaParser', () => {
    const resourceName = 'FunctionName';
    const path = `/2015-03-31/functions/${resourceName}/invocations?Qualifier=Qualifier`;
    const invocationType = 'InvocationType';
    const headers = {
      'x-amz-invocation-type': invocationType,
    };
    const requestData = { path, headers };
    const spanId = '1234-abcd-efgh';
    const responseData = { headers: { 'x-amzn-requestid': spanId } };
    const expected = {
      'aws.invocation.type': invocationType,
      'aws.request.id': spanId,
      'aws.resource.name': resourceName,
    };
    expect(aws.lambdaParser(requestData, responseData)).toEqual(expected);
  });

  test('lambdaParser with arn', () => {
    const resourceName = 'FunctionName';
    const arn = `arn:aws:lambda:eu-central-1:123847209798:function:${resourceName}`;
    const path = encodeURIComponent(
      `lambda.eu-central-1.amazonaws.com/2015-03-31/functions/${arn}/invocations?Qualifier=Qualifier`
    );
    const invocationType = 'InvocationType';
    const headers = {
      'x-amz-invocation-type': invocationType,
    };
    const requestData = { path, headers };
    const spanId = '1234-abcd-efgh';
    const responseData = { headers: { 'x-amzn-requestid': spanId } };
    const expected = {
      'aws.invocation.type': invocationType,
      'aws.request.id': spanId,
      'aws.resource.name': resourceName,
    };
    expect(aws.lambdaParser(requestData, responseData)).toEqual(expected);
  });

  test('snsParser -> happy flow (request)', () => {
    const topicArn = 'SOME-TOPIC-ARN';
    const requestData = {
      path: '/',
      port: 443,
      host: 'sns.us-west-2.amazonaws.com',
      body: `Action=Publish&Message=Some%20Message%20to%20SNS&TopicArn=${topicArn}&Version=2010-03-31`,
      method: 'POST',
      headers: {
        'content-length': 137,
        host: 'sns.us-west-2.amazonaws.com',
        'x-amz-date': '20190730T080719Z',
      },
      protocol: 'https:',
      sendTime: 1564474039619,
    };

    const result = aws.snsParser(requestData, {});

    expect(result).toEqual({
      'aws.resource.name': 'SOME-TOPIC-ARN',
      'aws.targetArn': 'SOME-TOPIC-ARN',
    });
  });

  test('snsParser -> happy flow (response)', () => {
    const response = {
      statusCode: 200,
      receivedTime: 1564495048705,
      body: '<PublishResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">\n  <PublishResult>\n    <MessageId>72eaeab7-267d-5bac-8eee-bf0d69758085</MessageId>\n  </PublishResult>\n  <ResponseMetadata>\n    <RequestId>3e7f7a41-4c85-5f51-8160-2ffb038d8478</RequestId>\n  </ResponseMetadata>\n</PublishResponse>\n',
      headers: {
        'x-amzn-requestid': '3e7f7a41-4c85-5f51-8160-2ffb038d8478',
        'x-amzn-trace-id':
          'Root=1-00007c9f-1f11443016dcb3200b19bbc0;Parent=3bfa041a0ae54e47;Sampled=0',
        'content-type': 'text/xml',
        'content-length': '294',
        date: 'Tue, 30 Jul 2019 13:57:27 GMT',
      },
    };

    const result = aws.snsParser({}, response);

    expect(result).toEqual({
      messageId: '72eaeab7-267d-5bac-8eee-bf0d69758085',
    });
  });

  test('snsParser -> happy flow (request + response)', () => {
    const topicArn = 'SOME-TOPIC-ARN';
    const requestData = {
      path: '/',
      port: 443,
      host: 'sns.us-west-2.amazonaws.com',
      body: `Action=Publish&Message=Some%20Message%20to%20SNS&TopicArn=${topicArn}&Version=2010-03-31`,
      method: 'POST',
      headers: {
        'content-length': 137,
        host: 'sns.us-west-2.amazonaws.com',
        'x-amz-date': '20190730T080719Z',
      },
      protocol: 'https:',
      sendTime: 1564474039619,
    };

    const response = {
      statusCode: 200,
      receivedTime: 1564495048705,
      body: '<PublishResponse xmlns="http://sns.amazonaws.com/doc/2010-03-31/">\n  <PublishResult>\n    <MessageId>72eaeab7-267d-5bac-8eee-bf0d69758085</MessageId>\n  </PublishResult>\n  <ResponseMetadata>\n    <RequestId>3e7f7a41-4c85-5f51-8160-2ffb038d8478</RequestId>\n  </ResponseMetadata>\n</PublishResponse>\n',
      headers: {
        'x-amzn-requestid': '3e7f7a41-4c85-5f51-8160-2ffb038d8478',
        'x-amzn-trace-id':
          'Root=1-00007c9f-1f11443016dcb3200b19bbc0;Parent=3bfa041a0ae54e47;Sampled=0',
        'content-type': 'text/xml',
        'content-length': '294',
        date: 'Tue, 30 Jul 2019 13:57:27 GMT',
      },
    };

    const result = aws.snsParser(requestData, response);

    expect(result).toEqual({
      'aws.resource.name': topicArn,
      'aws.targetArn': topicArn,
      messageId: '72eaeab7-267d-5bac-8eee-bf0d69758085',
    });
  });

  test('snsParser -> not success and return default values', () => {
    const requestData = {
      path: '/',
      port: 443,
      host: 'sns.us-west-2.amazonaws.com',
      sendTime: 1564474039619,
    };

    const result = aws.snsParser(requestData, {});

    expect(result).toEqual({
      resourceName: undefined,
      targetArn: undefined,
      messageId: undefined,
    });
  });

  [
    // send message single
    '<?xml version="1.0"?><SendMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><SendMessageResult><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><MD5OfMessageBody>c5cb6abef11b88049177473a73ed662f</MD5OfMessageBody></SendMessageResult><ResponseMetadata><RequestId>b6b5a045-23c6-5e3a-a54f-f7dd99f7b379</RequestId></ResponseMetadata></SendMessageResponse>',
    // send message batch (with one record)
    '<?xml version="1.0"?><SendMessageBatchResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><SendMessageBatchResult><SendMessageBatchResultEntry><Id>11dd068c-fb3c-43e8-a2ae-1a914780735f</Id><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><MD5OfMessageBody>c5cb6abef11b88049177473a73ed662f</MD5OfMessageBody></SendMessageBatchResultEntry></SendMessageBatchResult><ResponseMetadata><RequestId>b6b5a045-23c6-5e3a-a54f-f7dd99f7b379</RequestId></ResponseMetadata></SendMessageBatchResponse>',
    // receive message single
    '<?xml version=\\"1.0\\"?><ReceiveMessageResponse xmlns=\\"http://queue.amazonaws.com/doc/2012-11-05/\\"><ReceiveMessageResult><Message><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><ReceiptHandle>abcabcabc</ReceiptHandle><MD5OfBody>aaaaaaaaaaaaaaaaaaa</MD5OfBody><Body>myMessage</Body></Message></ReceiveMessageResult><ResponseMetadata><RequestId>abcdef-abcdef-abcdef-abcdef-abcdef</RequestId></ResponseMetadata></ReceiveMessageResponse>',
    // receive message batch
    '<?xml version=\\"1.0\\"?><ReceiveMessageResponse xmlns=\\"http://queue.amazonaws.com/doc/2012-11-05/\\"><ReceiveMessageResult><Message><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><ReceiptHandle>abcabcabc</ReceiptHandle><MD5OfBody>aaaaaaaaaaaaaaaaaaa</MD5OfBody><Body>Message 9</Body></Message><Message><MessageId>22222222-b060-47bc-9d89-c754d7260dbd</MessageId><ReceiptHandle>abcabcabc</ReceiptHandle><MD5OfBody>aaaa</MD5OfBody><Body>Message 14</Body></Message><Message><MessageId>33333333-b060-47bc-9d89-c754d7260dbd</MessageId><ReceiptHandle>abcabcabc</ReceiptHandle><MD5OfBody>aaaaa</MD5OfBody><Body>Message 35</Body></Message></ReceiveMessageResult><ResponseMetadata><RequestId>abcdef-abcdef-abcdef-abcdef-abcdef</RequestId></ResponseMetadata></ReceiveMessageResponse>',
  ].map((responseDataBody) =>
    test('sqsParser -> happy flow', () => {
      const queueUrl = 'https://sqs.us-west-2.amazonaws.com/33/random-queue-test';
      const encodedQueueUrl = encodeURIComponent(queueUrl);
      const requestData = {
        path: '/',
        port: 443,
        host: 'sqs.us-west-2.amazonaws.com',
        body: `Action=SendMessage&DelaySeconds=1&MessageBody=Some%20Message%20to%20SQS&QueueUrl=${encodedQueueUrl}`,
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
          'content-length': 172,
          host: 'sqs.us-west-2.amazonaws.com',
          'x-amz-date': '20190730T082312Z',
        },
        protocol: 'https:',
        sendTime: 1564474992235,
      };
      const responseData = { body: responseDataBody };

      const result = aws.sqsParser(requestData, responseData);

      expect(result).toEqual({
        'aws.resource.name': queueUrl,
        messageId: '85dc3997-b060-47bc-9d89-c754d7260dbd',
      });
    })
  );

  test('sqsParser -> truncated body', () => {
    const queueUrl = 'https://sqs.us-west-2.amazonaws.com/33/random-queue-test';
    const encodedQueueUrl = encodeURIComponent(queueUrl);
    const requestData = {
      host: 'sqs.us-west-2.amazonaws.com',
      body: `QueueUrl=${encodedQueueUrl}&DelaySeconds=1%...[too long]`,
      method: 'POST',
      headers: {
        host: 'sqs.us-west-2.amazonaws.com',
      },
    };

    const result = aws.sqsParser(requestData, {});

    expect(result).toEqual({
      'aws.resource.name': queueUrl,
      messageId: null,
    });
  });

  test('sqsParser -> empty request', () => {
    const result = aws.sqsParser({}, null);
    expect(result).toEqual({
      messageId: null,
    });
  });

  test('sqsParser -> not success and return default values', () => {
    const requestData = {
      path: '/',
      host: 'sqs.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
    };

    const result = aws.sqsParser(requestData, {});

    expect(result).toEqual({
      messageId: null,
      resourceName: undefined,
    });
  });

  [true, false].map((isEmptyResponse) => {
    test('sqsParser -> make sure skip export is calculated', () => {
      const queueUrl = 'https://sqs.us-west-2.amazonaws.com/33/random-queue-test';
      const encodedQueueUrl = encodeURIComponent(queueUrl);
      const requestData = {
        path: '/',
        port: 443,
        host: 'sqs.us-west-2.amazonaws.com',
        body: `Action=ReceiveMessage&QueueUrl=${encodedQueueUrl}&Version=2012-11-05`,
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
          'content-length': 172,
          host: 'sqs.us-west-2.amazonaws.com',
          'x-amz-date': '20190730T082312Z',
        },
        protocol: 'https:',
        sendTime: 1564474992235,
      };
      let responseBody;
      if (isEmptyResponse) {
        // empty response, no message id field
        responseBody =
          '<?xml version="1.0"?>' +
          '<ReceiveMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/">' +
          '<ReceiveMessageResult/>' +
          '<ResponseMetadata>' +
          '<RequestId>603a96e1-c8dd-572f-be46-cb98d79009bf</RequestId>' +
          '</ResponseMetadata>' +
          '</ReceiveMessageResponse>';
      } else {
        // non-empty response, it has a message id field
        responseBody =
          '<?xml version="1.0"?>' +
          '<SendMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/">' +
          '<SendMessageResult>' +
          '<MessageId>b2c50a65-0b64-457b-aaaf-6c66057a18e8</MessageId>' +
          '<MD5OfMessageBody>02c770fa2770c6d8b825e80d8cbed3cb</MD5OfMessageBody>' +
          '</SendMessageResult>' +
          '<ResponseMetadata>' +
          '<RequestId>257d5503-8386-567d-8a3b-087aa182c9d3</RequestId>' +
          '</ResponseMetadata>' +
          '</SendMessageResponse>';
      }
      const responseData = { body: responseBody };

      const result = aws.sqsParser(requestData, responseData);

      const skipSpanExportAttribute = result.SKIP_EXPORT;

      if (isEmptyResponse) {
        expect(skipSpanExportAttribute).toEqual(true);
      } else {
        expect([false, null, undefined].includes(skipSpanExportAttribute)).toEqual(true);
      }
    });
  });

  test('sqsParser -> with inner SNS', () => {
    const requestData = {
      host: 'sqs.us-west-2.amazonaws.com',
      body: `Action=SendMessage&DelaySeconds=1&MessageBody=Some%20Message%20to%20SQS&QueueUrl=queueUrl`,
    };
    const responseData = {
      body:
        '<?xml version="1.0"?><ReceiveMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><ReceiveMessageResult><Message><MessageId>sqs-message</MessageId><ReceiptHandle>aaaaaaaaaaaaaaa</ReceiptHandle><MD5OfBody>bbbbbbbbbbbbb</MD5OfBody><Body>{\n' +
        '  &quot;Type&quot; : &quot;Notification&quot;,\n' +
        '  &quot;MessageId&quot; : &quot;sns-message&quot;,\n' +
        '  &quot;TopicArn&quot; : &quot;arn:aws:sns:us-west-2:123456789:inner-sns&quot;,\n' +
        '  &quot;Message&quot; : &quot;{}&quot;,\n' +
        '  &quot;Timestamp&quot; : &quot;2023-01-15T10:29:01.127Z&quot;,\n' +
        '  &quot;SignatureVersion&quot; : &quot;1&quot;,\n' +
        '  &quot;SigningCertURL&quot; : &quot;https://sns.us-west-2.amazonaws.com/SimpleNotificationService-123456789.pem&quot;,\n' +
        '  &quot;UnsubscribeURL&quot; : &quot;https://sns.us-west-2.amazonaws.com/?Action=Unsubscribe&amp;SubscriptionArn=arn:aws:sns:us-west-2:123456789:inner-sns:123456789&quot;\n' +
        '}</Body></Message></ReceiveMessageResult><ResponseMetadata><RequestId>aaaa-bbbbb-cccccc-ddddd</RequestId></ResponseMetadata></ReceiveMessageResponse>',
    };

    const result = aws.sqsParser(requestData, responseData);
    const lumigoData = JSON.parse(result['lumigoData']);
    expect(lumigoData.trigger.length).toEqual(2);
    expect(lumigoData.trigger[1].targetId).toEqual(lumigoData.trigger[0].id);
    lumigoData.trigger.forEach((trigger) => {
      delete trigger.id;
      delete trigger.targetId;
    });
    expect(lumigoData.trigger).toEqual([
      {
        extra: {
          resource: 'queueUrl',
        },
        fromMessageIds: ['sqs-message'],
        triggeredBy: 'sqs',
      },
      {
        extra: {
          arn: 'arn:aws:sns:us-west-2:123456789:inner-sns',
        },
        fromMessageIds: ['sns-message'],
        triggeredBy: 'sns',
      },
    ]);
  });

  [
    // Don't skip a non-empty receive message
    {
      envVar: undefined,
      parsedReqBody: { Action: 'ReceiveMessage' },
      messageId: 'messageId',
      expectedShouldSkipSpan: false,
    },

    // Skip an empty receive message
    {
      envVar: undefined,
      parsedReqBody: { Action: 'ReceiveMessage' },
      messageId: null,
      expectedShouldSkipSpan: true,
    },
    {
      envVar: undefined,
      parsedReqBody: { Action: 'ReceiveMessage' },
      messageId: undefined,
      expectedShouldSkipSpan: true,
    },

    // Don't skip other actions, no matter if they have a message or not
    {
      envVar: undefined,
      parsedReqBody: { Action: 'OtherAction' },
      messageId: 'messageId',
      expectedShouldSkipSpan: false,
    },
    {
      envVar: undefined,
      parsedReqBody: { Action: 'OtherAction' },
      messageId: null,
      expectedShouldSkipSpan: false,
    },

    // Don't skip if parsedReqBody not in expected format
    { envVar: undefined, parsedReqBody: null, messageId: null, expectedShouldSkipSpan: false },
    { envVar: undefined, parsedReqBody: undefined, messageId: null, expectedShouldSkipSpan: false },
    { envVar: undefined, parsedReqBody: {}, messageId: null, expectedShouldSkipSpan: false },

    // Don't skip if env var is explicitly set to false
    {
      envVar: 'false',
      parsedReqBody: { Action: 'ReceiveMessage' },
      messageId: null,
      expectedShouldSkipSpan: false,
    },
    {
      envVar: 'false',
      parsedReqBody: { Action: 'ReceiveMessage' },
      messageId: undefined,
      expectedShouldSkipSpan: false,
    },
    {
      envVar: 'false',
      parsedReqBody: { Action: 'ReceiveMessage' },
      messageId: 'messageId',
      expectedShouldSkipSpan: false,
    },

    // Skip if env var is explicitly set to true
    {
      envVar: 'true',
      parsedReqBody: { Action: 'ReceiveMessage' },
      messageId: null,
      expectedShouldSkipSpan: true,
    },
    {
      envVar: 'true',
      parsedReqBody: { Action: 'ReceiveMessage' },
      messageId: undefined,
      expectedShouldSkipSpan: true,
    },

    // Don't skip if env var is set to true but response is not empty
    {
      envVar: 'true',
      parsedReqBody: { Action: 'ReceiveMessage' },
      messageId: 'messageId',
      expectedShouldSkipSpan: false,
    },

    // Skip by default if env var value is not supported
    {
      envVar: 'unknown',
      parsedReqBody: { Action: 'ReceiveMessage' },
      messageId: 'messageId',
      expectedShouldSkipSpan: false,
    },
    {
      envVar: 'unknown',
      parsedReqBody: { Action: 'ReceiveMessage' },
      messageId: null,
      expectedShouldSkipSpan: true,
    },
  ].map(({ envVar, parsedReqBody, messageId, expectedShouldSkipSpan }) => {
    test('sqsParser -> should skip span export', () => {
      process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS = envVar;
      expect(shouldSkipSqsSpan(parsedReqBody, messageId)).toEqual(expectedShouldSkipSpan);
    });
  });

  test('eventBridgeParser -> happy flow', () => {
    const requestData = {
      host: 'events.us-west-2.amazonaws.com',
      body: JSON.stringify({
        Entries: [
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 1}',
            EventBusName: 'test',
          },
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 2}',
            EventBusName: 'test',
          },
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 3}',
            EventBusName: 'test2',
          },
        ],
      }),
    };
    const responseData = {
      body: JSON.stringify({
        Entries: [{ EventId: '1-2-3-4' }, { EventId: '6-7-8-9' }],
        FailedEntryCount: 0,
      }),
    };

    const result = aws.eventBridgeParser(requestData, responseData);

    expect(result).toEqual({
      'aws.resource.names': ['test', 'test2'],
      messageIds: ['1-2-3-4', '6-7-8-9'],
    });
  });

  [
    {
      envVarValue: 'true',
      expectedShouldAutoFilter: true,
    },
    {
      envVarValue: 'TRUE',
      expectedShouldAutoFilter: true,
    },
    {
      envVarValue: 'True',
      expectedShouldAutoFilter: true,
    },
    {
      envVarValue: 'false',
      expectedShouldAutoFilter: false,
    },
    {
      envVarValue: 'FALSE',
      expectedShouldAutoFilter: false,
    },
    {
      envVarValue: 'False',
      expectedShouldAutoFilter: false,
    },
    {
      envVarValue: 'unsupportedValue',
      expectedShouldAutoFilter: true,
    },
    {
      envVarValue: '',
      expectedShouldAutoFilter: true,
    },
    {
      envVarValue: undefined,
      expectedShouldAutoFilter: true,
    },
  ].map(({envVarValue, expectedShouldAutoFilter}) => {
    test(`auto filter empty sqs response setting eval (LUMIGO_AUTO_FILTER_EMPTY_SQS=${envVarValue}, expected=${expectedShouldAutoFilter})`, () => {
      process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS = envVarValue;
      expect(shouldAutoFilterEmptySqs()).toEqual(expectedShouldAutoFilter);
    });
  });

  test('eventBridgeParser -> with response null', () => {
    const requestData = {
      host: 'events.us-west-2.amazonaws.com',
      body: JSON.stringify({
        Entries: [
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 1}',
            EventBusName: 'test',
          },
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 2}',
            EventBusName: 'test',
          },
          {
            Source: 'source_lambda',
            Resources: [],
            DetailType: 'string',
            Detail: '{"a": 3}',
            EventBusName: 'test2',
          },
        ],
      }),
    };
    const responseData = null;

    const result = aws.eventBridgeParser(requestData, responseData);

    expect(result).toEqual({
      'aws.resource.names': ['test', 'test2'],
    });
  });

  test('eventBridgeParser -> not success and return default values', () => {
    const requestData = {
      path: '/',
      host: 'events.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
    };

    const result = aws.eventBridgeParser(requestData, {});

    expect(result).toEqual({
      messageIds: undefined,
      resourceName: undefined,
    });
  });

  test('kinesisParser -> happy flow single put', () => {
    const streamName = 'RANDOM-STREAM-NAME';
    const requestData = {
      host: 'kinesis.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
      body: JSON.stringify({ StreamName: streamName }),
    };
    const responseData = {
      body: JSON.stringify({ SequenceNumber: '1' }),
    };

    const result = aws.kinesisParser(requestData, responseData);

    expect(result).toEqual({
      'aws.resource.name': streamName,
      messageId: '1',
    });
  });

  test('kinesisParser -> happy flow batch put', () => {
    const streamName = 'RANDOM-STREAM-NAME';
    const requestData = {
      host: 'kinesis.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
      body: JSON.stringify({ StreamName: streamName }),
    };
    const responseData = {
      body: JSON.stringify({
        Records: [{ SequenceNumber: '1' }, { SequenceNumber: '2' }, { Error: true }],
      }),
    };

    const result = aws.kinesisParser(requestData, responseData);

    expect(result).toEqual({
      'aws.resource.name': streamName,
      messageIds: ['1', '2'],
    });
  });

  test('kinesisParser -> not success and return default values', () => {
    const requestData = {
      host: 'kinesis.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
    };

    const result = aws.kinesisParser(requestData, {});

    expect(result).toEqual({
      'aws.resource.name': undefined,
    });
  });

  test('kinesisParser -> invalid response and return default values', () => {
    const requestData = {
      host: 'kinesis.us-west-2.amazonaws.com',
      sendTime: 1564474992235,
    };

    const responseData = {
      body: '<hello',
    };
    const result = aws.kinesisParser(requestData, responseData);

    expect(result).toEqual({
      'aws.resource.name': undefined,
    });
  });

  test('apigwParser -> api-gw v1 (with x-amzn-requestid header)', () => {
    const responseData = {
      host: '9bis5jsyh2.execute-api.us-west-2.amazonaws.com',
      headers: { 'x-amzn-requestid': '123' },
    };

    const result = aws.apigwParser({}, responseData);

    expect(result).toEqual({
      messageId: '123',
    });
  });

  test('apigwParser -> api-gw v2 (with Apigw-Requestid header)', () => {
    const responseData = {
      host: '9bis5jsyh2.execute-api.us-west-2.amazonaws.com',
      headers: { 'apigw-requestid': '123' },
    };

    const result = aws.apigwParser({}, responseData);

    expect(result).toEqual({
      messageId: '123',
    });
  });

  test('apigwParser -> api-gw v2 (with x-amzn-Requestid header)', () => {
    const responseData = {
      host: '9bis5jsyh2.execute-api.us-west-2.amazonaws.com',
      headers: { 'Apigw-Requestid': '123', 'x-amzn-requestid': 'x-amzn-123' },
    };

    const result = aws.apigwParser({}, responseData);

    expect(result).toEqual({
      messageId: 'x-amzn-123',
    });
  });

  test('awsParser -> happy flow (with x-amzn-requestid header)', () => {
    const responseData = {
      host: '9bis5jsyh2.execute-api.us-west-2.amazonaws.com',
      headers: { 'x-amzn-requestid': '123' },
    };

    const result = aws.awsParser({}, responseData);

    expect(result).toEqual({
      messageId: '123',
    });
  });

  test('awsParser -> happy flow (without x-amzn-requestid header)', () => {
    const responseData = {
      host: '9bis5jsyh2.execute-api.us-west-2.amazonaws.com',
      headers: { hello: 'world' },
    };

    const result = aws.awsParser({}, responseData);

    expect(result).toEqual({});
  });
});
