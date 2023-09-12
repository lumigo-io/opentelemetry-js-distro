import { logger } from '../logging';
import { md5Hash, parseQueryParams, removeDuplicates, safeGet } from '../utils';
import { traverse } from '../tools/xmlToJson';
import { HttpRawRequest, HttpRawResponse } from '@lumigo/node-core/lib/types/spans';
import { CommonUtils } from '@lumigo/node-core';
import { Triggers } from '@lumigo/node-core';
import { AwsServiceData } from '../spans/awsSpan';
import { getSpanSkipExportAttributes } from '../resources/spanProcessor';

const extractDynamodbMessageId = (reqBody, method) => {
  if (method === 'PutItem' && reqBody['Item']) {
    return md5Hash(reqBody.Item);
  } else if (method === 'UpdateItem' && reqBody['Key']) {
    return md5Hash(reqBody.Key);
  } else if (method === 'DeleteItem' && reqBody['Key']) {
    return md5Hash(reqBody.Key);
  } else if (method === 'BatchWriteItem') {
    const firstTableName = Object.keys(reqBody.RequestItems)[0];
    if (firstTableName) {
      const firstItem = reqBody.RequestItems[firstTableName][0];
      if (firstItem['PutRequest']) {
        return md5Hash(firstItem.PutRequest.Item);
      } else if (firstItem['DeleteRequest']) {
        return md5Hash(firstItem.DeleteRequest.Key);
      }
    }
  }
  return undefined;
};

const extractDynamodbTableName = (reqBody, method) => {
  const tableName = (reqBody['TableName'] && reqBody.TableName) || '';
  if (!tableName && ['BatchWriteItem', 'BatchGetItem'].includes(method)) {
    return Object.keys(reqBody.RequestItems)[0];
  }
  return tableName;
};

/**
 * returns an answer if we should filter empty sqs request spans, based on the LUMIGO_AUTO_FILTER_EMPTY_SQS env var.
 * The function handles many edge cases, but the basic logic is:
 * * LUMIGO_AUTO_FILTER_EMPTY_SQS="true" -> return true
 * * LUMIGO_AUTO_FILTER_EMPTY_SQS="false" -> return false
 */
export const shouldAutoFilterEmptySqs = (): boolean => {
  const defaultResponse = true;
  const autoFilterEmptySqsRaw = process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS;
  if (!autoFilterEmptySqsRaw) {
    return defaultResponse;
  }
  const autoFilterEmptySqsLowerCase = autoFilterEmptySqsRaw.toLowerCase();
  if (!['true', 'false'].includes(autoFilterEmptySqsLowerCase)) {
    logger.warn(
      `Invalid boolean value for LUMIGO_AUTO_FILTER_EMPTY_SQS env var: ${autoFilterEmptySqsRaw}`
    );
    return defaultResponse;
  }

  return autoFilterEmptySqsLowerCase !== 'false';
};

export const shouldSkipSqsSpan = (parsedReqBody, messageId) => {
  if (!parsedReqBody) {
    return false;
  }

  const sqsRequestAction = parsedReqBody['Action'];

  return sqsRequestAction === 'ReceiveMessage' && !messageId && shouldAutoFilterEmptySqs();
};

export const dynamodbParser = (requestData) => {
  const { headers: reqHeaders, body: reqBody } = requestData;
  const dynamodbMethod =
    (reqHeaders['x-amz-target'] && reqHeaders['x-amz-target'].split('.')[1]) || '';

  const reqBodyJSON = (!!reqBody && JSON.parse(reqBody)) || {};
  const resourceName = extractDynamodbTableName(reqBodyJSON, dynamodbMethod);
  const messageId = extractDynamodbMessageId(reqBodyJSON, dynamodbMethod);

  return {
    'aws.resource.name': resourceName,
    'aws.dynamodb.method': dynamodbMethod,
    messageId,
  };
};

// non-official
export const isArn = (arnToValidate) => {
  return arnToValidate.startsWith('arn:aws:');
};

export const extractLambdaNameFromArn = (arn) => arn.split(':')[6];

export const lambdaParser = (requestData: HttpRawRequest, responseData: HttpRawResponse) => {
  if (!responseData) return {};
  const { path, headers } = requestData;
  let resourceName = decodeURIComponent(path).split('/')[3];
  resourceName = isArn(resourceName) ? extractLambdaNameFromArn(resourceName) : resourceName;
  const { headers: responseHeaders } = responseData;
  const spanId = responseHeaders['x-amzn-requestid'] || responseHeaders['x-amz-requestid'] || '';
  const invocationType = headers['x-amz-invocation-type'];
  return {
    'aws.resource.name': resourceName,
    'aws.invocation.type': invocationType,
    'aws.request.id': spanId,
  };
};

export const snsParser = (requestData, responseData) => {
  if (!responseData) return {};
  const { body: reqBody } = requestData;
  const { body: resBody } = responseData;
  const parsedRequestBody = reqBody ? parseQueryParams(reqBody) : undefined;
  const parsedResponseBody = resBody ? traverse(resBody) : undefined;
  const resourceName = parsedRequestBody ? parsedRequestBody['TopicArn'] : undefined;
  const messageId = parsedResponseBody
    ? ((parsedResponseBody['PublishResponse'] || {})['PublishResult'] || {})['MessageId']
    : undefined;

  return {
    'aws.resource.name': resourceName,
    'aws.targetArn': resourceName,
    messageId,
  };
};

export const apigwParser = (requestData, responseData) => {
  if (!responseData) return {};
  let baseData = awsParser(requestData, responseData);
  if (!baseData) {
    baseData = {};
  }
  if (!baseData.messageId) {
    const { headers: resHeader } = responseData;
    if (resHeader && resHeader['apigw-requestid']) {
      baseData.messageId = resHeader['apigw-requestid'];
    }
  }
  return baseData;
};

export const eventBridgeParser = (requestData, responseData) => {
  const { body: reqBody } = requestData;
  const { body: resBody } = responseData || {};
  const reqBodyJSON = (!!reqBody && JSON.parse(reqBody)) || {};
  const resBodyJSON = (!!resBody && JSON.parse(resBody)) || {};
  const resourceNames = reqBodyJSON.Entries
    ? removeDuplicates(reqBodyJSON.Entries.map((entry) => entry.EventBusName))
    : undefined;
  const messageIds = resBodyJSON.Entries
    ? resBodyJSON.Entries.map((entry) => entry.EventId)
    : undefined;
  return {
    'aws.resource.names': resourceNames,
    messageIds: messageIds,
  };
};

export const sqsParser = (requestData, responseData) => {
  console.log('sqsParser', requestData, responseData);
  const { body: reqBody } = requestData;
  const { body: resBody } = responseData || {};
  const parsedReqBody = reqBody ? parseQueryParams(reqBody) : undefined;
  const parsedResBody = resBody ? traverse(resBody) : undefined;
  const resourceName = parsedReqBody ? parsedReqBody['QueueUrl'] : undefined;
  const awsServiceData: AwsServiceData = { 'aws.resource.name': resourceName };
  awsServiceData.messageId =
    safeGet(parsedResBody, ['SendMessageResponse', 'SendMessageResult', 'MessageId'], undefined) ||
    safeGet(
      parsedResBody,
      [
        'SendMessageBatchResponse',
        'SendMessageBatchResult',
        'SendMessageBatchResultEntry',
        0,
        'MessageId',
      ],
      undefined
    ) ||
    safeGet(
      parsedResBody,
      [
        'SendMessageBatchResponse',
        'SendMessageBatchResult',
        'SendMessageBatchResultEntry',
        'MessageId',
      ],
      undefined
    ) ||
    safeGet(
      parsedResBody,
      ['ReceiveMessageResponse', 'ReceiveMessageResult', 'Message', 'MessageId'],
      undefined
    ) ||
    safeGet(
      parsedResBody,
      ['ReceiveMessageResponse', 'ReceiveMessageResult', 'Message', 0, 'MessageId'],
      undefined
    );
  const innerRaw = parsedResBody?.ReceiveMessageResponse?.ReceiveMessageResult?.Message?.Body || '';
  if (innerRaw.search(Triggers.INNER_MESSAGES_IDENTIFIER_PATTERN) > 0) {
    const inner = JSON.parse(innerRaw.replace(/&quot;/g, '"'));
    const mainTrigger = {
      id: CommonUtils.getRandomString(10),
      targetId: null,
      triggeredBy: Triggers.MessageTrigger.SQS,
      fromMessageIds: [awsServiceData.messageId],
      extra: { resource: resourceName },
    };
    awsServiceData.lumigoData = JSON.stringify({
      trigger: [mainTrigger, ...Triggers.recursiveParseTriggers(inner, mainTrigger.id)],
    });
  }

  if (shouldSkipSqsSpan(parsedReqBody, awsServiceData.messageId)) {
    logger.info(
      `Not tracing empty SQS polling requests (override by setting the env var LUMIGO_AUTO_FILTER_EMPTY_SQS=FALSE)`
    );
    Object.assign(awsServiceData, getSpanSkipExportAttributes());
  }

  return awsServiceData;
};

export const kinesisParser = (requestData, responseData) => {
  const { body: reqBody } = requestData;
  const { body: resBody } = responseData;
  const reqBodyJSON = (!!reqBody && JSON.parse(reqBody)) || {};
  let resBodyJSON: object;
  try {
    resBodyJSON = (!!resBody && JSON.parse(resBody)) || {};
  } catch (e) {
    logger.debug(`Unable to parse response, ${e}`);
    resBodyJSON = {};
  }
  const resourceName = (reqBodyJSON['StreamName'] && reqBodyJSON.StreamName) || undefined;
  const awsServiceData = { 'aws.resource.name': resourceName };
  if (resBodyJSON['SequenceNumber']) {
    // @ts-ignore
    awsServiceData.messageId = resBodyJSON['SequenceNumber'];
  }
  if (Array.isArray(resBodyJSON['Records'])) {
    // @ts-ignore
    awsServiceData.messageIds = resBodyJSON['Records']
      .map((r) => r['SequenceNumber'])
      .filter((x) => !!x);
  }
  return awsServiceData;
};

export const awsParser = (requestData, responseData) => {
  if (!responseData) return {};
  const { headers: resHeader } = responseData;
  const messageId = resHeader
    ? resHeader['x-amzn-requestid'] || resHeader['x-amz-request-id']
    : undefined;

  return messageId ? { messageId } : {};
};
