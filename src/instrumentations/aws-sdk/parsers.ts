import { CommonUtils, Triggers } from '@lumigo/node-core';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { logger } from '../../logging';

type SqsReceivedMessage = {
  Body: string;
  MessageId: string;
};

type SendMessageResponse = {
  MessageId: string;
};

type SendMessageBatchResponse = {
  Successful: SendMessageResponse[];
  Failed: SendMessageResponse[];
};

type ReceiveMessageResponse = {
  Messages: SqsReceivedMessage[];
};

type SqsResponse = SendMessageResponse | ReceiveMessageResponse | SendMessageBatchResponse;

type ParseAwsServiceProperties = {
  messageId?: string;
  lumigoData?: string;
  'aws.resource.name'?: string;
};

const safeJsonParse = (maybeJson: string) => {
  try {
    return JSON.parse(maybeJson);
  } catch (e) {
    return undefined;
  }
};

export const sqsParser = (
  sqsResponse: SqsResponse,
  span: ReadableSpan
): ParseAwsServiceProperties => {
  const spanAttributes = span['attributes'] || {};
  const operation = spanAttributes['rpc.method'];
  const awsResourceName = spanAttributes['messaging.url'] as string;
  const baseAttributes = { 'aws.resource.name': awsResourceName };

  switch (operation) {
    case 'ReceiveMessage': {
      const messages = (sqsResponse as ReceiveMessageResponse).Messages;
      const messageId = messages[0]?.MessageId;
      let lumigoData;

      const innerRaw = messages[0]?.Body ?? '';
      if (innerRaw.search(Triggers.INNER_MESSAGES_IDENTIFIER_PATTERN) > 0) {
        // TODO: what if the inner message is not a JSON?
        const inner = safeJsonParse(innerRaw);
        if (inner !== undefined) {
          const mainTrigger = {
            id: CommonUtils.getRandomString(10),
            targetId: null,
            triggeredBy: Triggers.MessageTrigger.SQS,
            fromMessageIds: [messageId],
            extra: { resource: spanAttributes['messaging.url'] },
          };

          lumigoData = JSON.stringify({
            trigger: [mainTrigger, ...Triggers.recursiveParseTriggers(inner, mainTrigger.id)],
          });
        }
      }

      return {
        messageId,
        lumigoData,
        ...baseAttributes,
      };
    }
    case 'SendMessage':
      return {
        messageId: (sqsResponse as SendMessageResponse).MessageId,
        ...baseAttributes,
      };

    case 'SendMessageBatch':
      return {
        messageId: (sqsResponse as SendMessageBatchResponse).Successful[0]?.MessageId,
        ...baseAttributes,
      };

    default:
      logger.debug('Unknown SQS operation', { operation });
      return {};
  }
};
