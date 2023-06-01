import { Span } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

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

export enum AwsOtherService {
  ApiGateway,
  ExternalService,
  ElasticBeanstalkSqsDaemon,
}

export enum AwsParsedService {
  DynamoDB = 'dynamodb',
  EventBridge = 'events',
  Kinesis = 'kinesis',
  Lambda = 'lambda',
  SNS = 'sns',
  SQS = 'sqs',
}

const AMAZON_REQUESTID_HEADER_NAME = 'x-amzn-requestid';

export const getAwsServiceFromHost = (host = ''): AwsParsedService | AwsOtherService => {
  if (host?.includes('.execute-api.')) {
    // E.g. `my_happy_api.execute-api.eu-central-1.amazonaws.com`
    return AwsOtherService.ApiGateway;
  }

  /*
   * The AWS service name for the API is usually the first segment of the host, e.g.,
   * `sqs.us-east-1.amazonaws.com`.
   */
  const service = host.split('.')[0];

  for (const awsParsedService in AwsParsedService) {
    if (AwsParsedService[awsParsedService].includes(service)) {
      return AwsParsedService[awsParsedService];
    }
  }

  return AwsOtherService.ExternalService;
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
  let awsService: AwsParsedService | AwsOtherService;

  const { host } = requestData;
  if (host?.includes('amazonaws.com')) {
    awsService = getAwsServiceFromHost(host);
  } else if (span.attributes[SemanticAttributes.HTTP_USER_AGENT]?.startsWith('aws-sqsd')) {
    /*
     * Workaround for Elastic Beanstalk, where a local proxy called "AWS SQS Daemon"
     * is used to fetch SQS messages, causing the hostname to be `localhost`.
     *
     * See https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features-managing-env-tiers.html#worker-daemon
     */
    awsService = AwsOtherService.ElasticBeanstalkSqsDaemon;
  } else if (
    responseData?.headers[AMAZON_REQUESTID_HEADER_NAME] ||
    responseData?.headers[AMAZON_REQUESTID_HEADER_NAME]
  ) {
    awsService = AwsOtherService.ExternalService;
  } else {
    // not an aws service
    return {};
  }

  const serviceData = getServiceAttributes(awsService, requestData, responseData);

  // If the service is one in the AwsParsedService enum, we also need to extract the region
  if (Object.values(AwsParsedService).includes(awsService as AwsParsedService)) {
    serviceData['aws.region'] = host.split('.')[1];
  }

  return serviceData;
};

const getServiceAttributes = (
  awsService: AwsParsedService | AwsOtherService,
  requestData,
  responseData
) => {
  switch (awsService) {
    case AwsOtherService.ApiGateway:
      return apigwParser(requestData, responseData);
    case AwsParsedService.DynamoDB:
      return dynamodbParser(requestData);
    case AwsParsedService.SNS:
      return snsParser(requestData, responseData);
    case AwsParsedService.Lambda:
      return lambdaParser(requestData, responseData);
    case AwsOtherService.ElasticBeanstalkSqsDaemon:
      // Same as AwsParsedService.SQS
      return sqsParser(requestData, responseData);
    case AwsParsedService.SQS:
      return sqsParser(requestData, responseData);
    case AwsParsedService.Kinesis:
      return kinesisParser(requestData, responseData);
    case AwsParsedService.EventBridge:
      return eventBridgeParser(requestData, responseData);
    default:
      return awsParser(requestData, responseData);
  }
};
