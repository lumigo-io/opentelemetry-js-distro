import {
  dynamodbParser,
  snsParser,
  lambdaParser,
  sqsParser,
  kinesisParser,
  awsParser,
  apigwParser,
  eventBridgeParser,
} from '../parsers/aws';
import {Span} from "@opentelemetry/api";

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
  [key: string]: any;
};
export const getAwsServiceData = (requestData, responseData, span: Span): AwsServiceData => {
  const { host } = requestData;
  const awsService = getAwsServiceFromHost(host);

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