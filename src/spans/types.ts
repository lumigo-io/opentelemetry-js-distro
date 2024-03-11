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

export type SupportedAwsServices = AwsParsedService | AwsOtherService;
