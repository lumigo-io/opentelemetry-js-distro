import { AwsOtherService, AwsParsedService, getAwsServiceData, getAwsServiceFromHost } from './awsSpan';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';

describe('awsSpan', () => {

  describe('getAwsServiceFromHost', () => {

    test('with an ApiGateway', () => {
      expect(getAwsServiceFromHost(new URL('https://my_happy_api.execute-api.eu-central-1.amazonaws.com/production/').hostname)).toBe(AwsOtherService.ApiGateway);
    });

    test('with an SQS queue URL', () => {
      // Example from https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_GetQueueUrl.html
      expect(getAwsServiceFromHost(new URL('https://sqs.us-east-1.amazonaws.com/177715257436/MyQueue').hostname)).toBe(AwsParsedService.SQS);
    });

  });

  describe('getAwsServiceData', () => {

    describe('SQS', () => {

      test('SQS queue', () => {
        const requestData = {
          body: '',
        };
        const responseData = {
          body: '<?xml version="1.0"?><SendMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><SendMessageResult><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><MD5OfMessageBody>c5cb6abef11b88049177473a73ed662f</MD5OfMessageBody></SendMessageResult><ResponseMetadata><RequestId>b6b5a045-23c6-5e3a-a54f-f7dd99f7b379</RequestId></ResponseMetadata></SendMessageResponse>',
        };
        const provider = new BasicTracerProvider();
        const root = provider.getTracer('default').startSpan('root');
        root.setAttribute('http.user_agent', 'aws-sqsd/3.0.4');
        root.end();
        // @ts-ignore
        const awsServiceData = getAwsServiceData(requestData, responseData, root);
    
        expect(awsServiceData).toMatchObject({
          messageId: '85dc3997-b060-47bc-9d89-c754d7260dbd'
        });
        expect(awsServiceData).not.toHaveProperty('aws.region');
      });

      test('Elastic Beanstalk SQS Daemon', () => {
        const requestData = {
          host: 'localhost',
          body: '',
        };
        const responseData = {
          body: '<?xml version="1.0"?><SendMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><SendMessageResult><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><MD5OfMessageBody>c5cb6abef11b88049177473a73ed662f</MD5OfMessageBody></SendMessageResult><ResponseMetadata><RequestId>b6b5a045-23c6-5e3a-a54f-f7dd99f7b379</RequestId></ResponseMetadata></SendMessageResponse>',
        };
        const provider = new BasicTracerProvider();
        const root = provider.getTracer('default').startSpan('root');
        root.setAttribute('http.user_agent', 'aws-sqsd/3.0.4');
        root.end();
        // @ts-ignore
        const awsServiceData = getAwsServiceData(requestData, responseData, root);
    
        expect(awsServiceData).toMatchObject({
          messageId: '85dc3997-b060-47bc-9d89-c754d7260dbd'
        });
        expect(awsServiceData).not.toHaveProperty('aws.region');
      });
  
    });

  });

});
