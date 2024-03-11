import { extractAttributesFromSqsResponse } from './attribute-extractors';
import { rootSpanWithAttributes } from '../../../test/utils/spans';
import { Triggers } from '@lumigo/node-core';
import 'jest-json';

describe('extractAttributesFromSqsResponse', () => {
  const queueUrl = 'https://sqs.us-east-1.amazonaws.com/177715257436/MyQueue';
  const sqsMessageId = 'sqs-message-id-123';

  describe('ReceiveMessage operations', () => {
    test('builds the attribute-data correctly for inner messages', () => {
      const innerMessageId = 'sns-message-message-id-123';
      const snsTopicArn = 'arn:aws:sns:us-west-2:123456789:inner-sns';
      const innerMessageBody = JSON.stringify({
        Type: 'Notification',
        MessageId: innerMessageId,
        TopicArn: 'arn:aws:sns:us-west-2:123456789:inner-sns',
        Message: '{}',
        Timestamp: '2023-01-15T10:29:01.127Z',
        SignatureVersion: '1',
        SigningCertURL:
          'https://sns.us-west-2.amazonaws.com/SimpleNotificationService-123456789.pem',
        UnsubscribeURL:
          'https://sns.us-west-2.amazonaws.com/?Action=Unsubscribe&amp;SubscriptionArn=arn:aws:sns:us-west-2:123456789:inner-sns:123456789',
      });
      const sqsMessage = { Body: innerMessageBody, MessageId: sqsMessageId };
      const receiveMessagesSpan = rootSpanWithAttributes({
        'messaging.url': queueUrl,
        'rpc.method': 'ReceiveMessage',
      });
      const result = extractAttributesFromSqsResponse(
        { Messages: [sqsMessage] },
        receiveMessagesSpan
      );

      expect(result).toMatchObject({
        messageId: sqsMessageId,
        'aws.resource.name': queueUrl,
        lumigoData: expect.jsonMatching({
          trigger: [
            {
              id: expect.any(String),
              targetId: null,
              triggeredBy: Triggers.MessageTrigger.SQS,
              fromMessageIds: [sqsMessageId],
              extra: { resource: queueUrl },
            },
            {
              id: expect.any(String),
              targetId: expect.any(String),
              triggeredBy: Triggers.MessageTrigger.SNS,
              fromMessageIds: [innerMessageId],
              extra: { arn: snsTopicArn },
            },
          ],
        }),
      });
    });

    test('does not produce a messageId when no messages received', () => {
      const receiveMessagesSpan = rootSpanWithAttributes({
        'messaging.url': queueUrl,
        'rpc.method': 'ReceiveMessage',
      });
      const result = extractAttributesFromSqsResponse({ Messages: [] }, receiveMessagesSpan);

      expect(result).toMatchObject({ 'aws.resource.name': queueUrl });
    });

    test('does not produce a messageId when a bad response is received', () => {
      const receiveMessagesSpan = rootSpanWithAttributes({
        'messaging.url': queueUrl,
        'rpc.method': 'ReceiveMessage',
      });
      // @ts-expect-error
      const result = extractAttributesFromSqsResponse({}, receiveMessagesSpan);

      expect(result).toMatchObject({ 'aws.resource.name': queueUrl });
    });

    test('does not produce lumigoData when a message has empty body', () => {
      const receiveMessagesSpan = rootSpanWithAttributes({
        'messaging.url': queueUrl,
        'rpc.method': 'ReceiveMessage',
      });
      const result = extractAttributesFromSqsResponse(
        { Messages: [{ Body: '', MessageId: sqsMessageId }] },
        receiveMessagesSpan
      );

      expect(result).toMatchObject({ 'aws.resource.name': queueUrl });
    });

    test('does not produce lumigoData for a message with a non-json payload', () => {
      const innerMessageIdentifier = Triggers.MESSAGE_TRIGGER_PARSERS.find(
        (p) => !!p.INNER_IDENTIFIER
      )?.INNER_IDENTIFIER;
      const receiveMessagesSpan = rootSpanWithAttributes({
        'messaging.url': queueUrl,
        'rpc.method': 'ReceiveMessage',
      });
      const result = extractAttributesFromSqsResponse(
        { Messages: [{ Body: `{Bad ${innerMessageIdentifier} JSON}`, MessageId: sqsMessageId }] },
        receiveMessagesSpan
      );

      expect(result).toMatchObject({ 'aws.resource.name': queueUrl });
    });
  });

  describe('SendMessage operations', () => {
    test('builds the attribute-data correctly for inner messages', () => {
      const sendMessageSpan = rootSpanWithAttributes({
        'messaging.url': queueUrl,
        'rpc.method': 'SendMessage',
      });
      const result = extractAttributesFromSqsResponse({ MessageId: sqsMessageId }, sendMessageSpan);

      expect(result).toMatchObject({
        messageId: sqsMessageId,
        'aws.resource.name': queueUrl,
      });
    });
  });

  describe('SendMessageBatch operations', () => {
    test('builds the attribute-data correctly using successful messages if available', () => {
      const sendMessageSpan = rootSpanWithAttributes({
        'messaging.url': queueUrl,
        'rpc.method': 'SendMessageBatch',
      });
      const result = extractAttributesFromSqsResponse(
        { Successful: [{ MessageId: sqsMessageId }], Failed: [{ MessageId: 'this-one-failed' }] },
        sendMessageSpan
      );

      expect(result).toMatchObject({
        messageId: sqsMessageId,
        'aws.resource.name': queueUrl,
      });
    });

    test('does not produce a messageId property if all messages in the batch failed', () => {
      const sendMessageSpan = rootSpanWithAttributes({
        'messaging.url': queueUrl,
        'rpc.method': 'SendMessageBatch',
      });
      const result = extractAttributesFromSqsResponse(
        { Successful: [], Failed: [{ MessageId: 'this-one-failed' }] },
        sendMessageSpan
      );

      expect(result).toMatchObject({ 'aws.resource.name': queueUrl });
    });

    test('does not produce a messageId when a bad response is received', () => {
      const receiveMessagesSpan = rootSpanWithAttributes({
        'messaging.url': queueUrl,
        'rpc.method': 'SendMessageBatch',
      });
      // @ts-expect-error
      const result = extractAttributesFromSqsResponse({}, receiveMessagesSpan);

      expect(result).toMatchObject({ 'aws.resource.name': queueUrl });
    });
  });

  describe('Unsupported operations', () => {
    test('returns an empty object for unsupported operations', () => {
      const sendMessageSpan = rootSpanWithAttributes({
        'messaging.url': queueUrl,
        'rpc.method': 'SomeWeirdStuff',
      });
      const result = extractAttributesFromSqsResponse(
        { Successful: [], Failed: [{ MessageId: 'this-one-failed' }] },
        sendMessageSpan
      );

      expect(result).toMatchObject({});
    });
  });
});
