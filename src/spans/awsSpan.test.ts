import { getAwsServiceData, getAwsServiceFromHost } from './awsSpan';
import { Span } from '@opentelemetry/sdk-trace-base';
import { AwsOtherService, AwsParsedService } from './types';
import { rootSpanWithAttributes } from '../../test/utils/spans';
import { LumigoAwsSdkLibInstrumentation } from '../instrumentations/aws-sdk/LumigoAwsSdkLibInstrumentation';

describe('awsSpan', () => {
  describe('getAwsServiceFromHost', () => {
    test('with an ApiGateway', () => {
      expect(
        getAwsServiceFromHost(
          new URL('https://my_happy_api.execute-api.eu-central-1.amazonaws.com/production/')
            .hostname
        )
      ).toBe(AwsOtherService.ApiGateway);
    });

    test('with an SQS queue URL', () => {
      // Example from https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_GetQueueUrl.html
      expect(
        getAwsServiceFromHost(
          new URL('https://sqs.us-east-1.amazonaws.com/177715257436/MyQueue').hostname
        )
      ).toBe(AwsParsedService.SQS);
    });
  });

  describe('getAwsServiceData', () => {
    describe('when native aws-sdk instrumentation is inapplicable', () => {
      test('does not mark SQS spans as skipped ', () => {
        jest.isolateModules(() => {
          process.env._LUMIGO_AWS_INSTRUMENTATION_SPAN_ACTIVE = 'false';

          const requestData = {
            body: '',
            host: 'sqs.us-east-1.amazonaws.com',
          };
          const responseData = {
            body: '<?xml version="1.0"?><SendMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><SendMessageResult><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><MD5OfMessageBody>c5cb6abef11b88049177473a73ed662f</MD5OfMessageBody></SendMessageResult><ResponseMetadata><RequestId>b6b5a045-23c6-5e3a-a54f-f7dd99f7b379</RequestId></ResponseMetadata></SendMessageResponse>',
          };
          const root = rootSpanWithAttributes({});
          const awsServiceAttributes = getAwsServiceData(requestData, responseData, root as Span);
          expect(awsServiceAttributes).not.toEqual({});

          expect(root.attributes['SKIP_EXPORT']).toBeUndefined();
        })
      })

      test('does not mark Elastic Beanstalk SQS Daemon spans as skipped', () => {
        const requestData = {
          host: 'localhost',
          body: '',
        };
        const responseData = {
          body: '<?xml version="1.0"?><SendMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><SendMessageResult><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><MD5OfMessageBody>c5cb6abef11b88049177473a73ed662f</MD5OfMessageBody></SendMessageResult><ResponseMetadata><RequestId>b6b5a045-23c6-5e3a-a54f-f7dd99f7b379</RequestId></ResponseMetadata></SendMessageResponse>',
        };
        const root = rootSpanWithAttributes({ 'http.user_agent': 'aws-sqsd/3.0.4' });
        // @ts-ignore
        const awsServiceData = getAwsServiceData(requestData, responseData, root);

        // Temporary, required until the http instrumentation is suppressed by the aws-sdk one
        expect(root.attributes['SKIP_EXPORT']).toBeUndefined();

        // Temporary, required until the http instrumentation is suppressed by the aws-sdk one
        expect(awsServiceData).toMatchObject({
          messageId: '85dc3997-b060-47bc-9d89-c754d7260dbd',
        });

        expect(awsServiceData).not.toHaveProperty('aws.region');
      });
    });

    describe('when native aws-sdk instrumentation is applicable', () => {
      test('marks SQS spans as skipped', () => {
        jest.isolateModules(() => {
          process.env._LUMIGO_AWS_INSTRUMENTATION_SPAN_ACTIVE = 'true';

          const requestData = {
            body: '',
            host: 'sqs.us-east-1.amazonaws.com',
          };
          const responseData = {
            body: '<?xml version="1.0"?><SendMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><SendMessageResult><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><MD5OfMessageBody>c5cb6abef11b88049177473a73ed662f</MD5OfMessageBody></SendMessageResult><ResponseMetadata><RequestId>b6b5a045-23c6-5e3a-a54f-f7dd99f7b379</RequestId></ResponseMetadata></SendMessageResponse>',
          };
          const root = rootSpanWithAttributes({});
          const awsServiceAttributes = getAwsServiceData(requestData, responseData, root as Span);
          expect(awsServiceAttributes).toEqual({});

          // Temporary, required until the http instrumentation is suppressed by the aws-sdk one
          expect(root.attributes).toHaveProperty('SKIP_EXPORT', true);
        })
      });

      test('marks Elastic Beanstalk SQS Daemon spans as skipped', () => {
        jest.isolateModules(() => {
          process.env._LUMIGO_AWS_INSTRUMENTATION_SPAN_ACTIVE = 'true';

          const requestData = {
            host: 'localhost',
            body: '',
          };
          const responseData = {
            body: '<?xml version="1.0"?><SendMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><SendMessageResult><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><MD5OfMessageBody>c5cb6abef11b88049177473a73ed662f</MD5OfMessageBody></SendMessageResult><ResponseMetadata><RequestId>b6b5a045-23c6-5e3a-a54f-f7dd99f7b379</RequestId></ResponseMetadata></SendMessageResponse>',
          };
          const root = rootSpanWithAttributes({ 'http.user_agent': 'aws-sqsd/3.0.4' });
          // @ts-ignore
          const awsServiceData = getAwsServiceData(requestData, responseData, root);

          // Temporary, required until the http instrumentation is suppressed by the aws-sdk one
          expect(root.attributes).toHaveProperty('SKIP_EXPORT', true);

          // Temporary, required until the http instrumentation is suppressed by the aws-sdk one
          expect(awsServiceData).not.toMatchObject({
            messageId: '85dc3997-b060-47bc-9d89-c754d7260dbd',
          });

          expect(awsServiceData).not.toHaveProperty('aws.region');
        });
      });
    });
  });
});
