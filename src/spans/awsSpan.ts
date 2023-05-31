import {
  apigwParser,
  awsParser,
  dynamodbParser,
  eventBridgeParser,
  kinesisParser,
  lambdaParser,
  snsParser,
  sqsParser,
} from '../parsers/aws';
import { Span } from '@opentelemetry/api';

export const EXTERNAL_SERVICE = 'external';

export const AWS_PARSED_SERVICES = ['dynamodb', 'sns', 'lambda', 'sqs', 'kinesis', 'events'];

export const getAwsServiceFromHost = (host = '') => {
  const service = host.split('.')[0];
  if (AWS_PARSED_SERVICES.includes(service)) {
    return service;
  }

  if (host.includes('execute-api')) return 'apigw';

  return EXTERNAL_SERVICE;
};

export type AwsServiceData = {
  awsServiceData?: {
    [key: string]: any;
  };
  messageId?: string;
  lumigoData?: string;
  [key: string]: any;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getAwsServiceData = (
  requestData,
  responseData,
  span: Span & { attributes: Record<string, string> }
): AwsServiceData => {
  let awsService;

  const { host } = requestData;
  if (host && host.includes('amazonaws.com')) {
    awsService = getAwsServiceFromHost(host);
  } else if (
    responseData &&
    responseData.headers &&
    (responseData.headers['x-amzn-requestid'] || responseData.headers['x-amz-request-id'])
  ) {
    awsService = EXTERNAL_SERVICE;
  } else if (span.attributes['http.user_agent']?.startsWith('aws-sqsd')) {
    awsService = 'sqs';
  } else {
    // not an aws service
    return {};
  }

  switch (awsService) {
    case 'dynamodb':
      return dynamodbParser(requestData);
    case 'sns':
      return snsParser(requestData, responseData);
    case 'lambda':
      return lambdaParser(requestData, responseData);
    case 'sqs':
      return sqsParser(requestData, responseData);
    case 'kinesis':
      return kinesisParser(requestData, responseData);
    case 'apigw':
      return apigwParser(requestData, responseData);
    case 'events':
      return eventBridgeParser(requestData, responseData);
    default:
      return awsParser(requestData, responseData);
  }
};
