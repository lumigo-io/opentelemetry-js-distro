import { responseHook, preRequestHook } from './hooks';
import type {
  AwsSdkRequestHookInformation,
  AwsSdkResponseHookInformation,
} from '@opentelemetry/instrumentation-aws-sdk';
import { rootSpanWithAttributes } from '../../../test/utils/spans';

describe('aws-sdk instrumentation hooks', () => {
  describe('responseHook', () => {
    it('adds attributes to a span coming from SQS', () => {
      const span = rootSpanWithAttributes({ 'aws.service.identifier': 'sqs' });
      const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({
        Messages: [{ Body: 'something' }],
      });

      responseHook(span, awsSdkResponse);

      expect(span.attributes).toMatchObject({
        'messaging.consume.body': JSON.stringify(awsSdkResponse.response.data),
      });
      expect(span.attributes).not.toHaveProperty('SKIP_EXPORT');
    });

    describe('filtering empty SQS responses', () => {
      describe("when LUMIGO_AUTO_FILTER_EMPTY_SQS is 'false'", () => {
        beforeEach(() => {
          process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS = 'false';
        });

        afterEach(() => {
          delete process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS;
        });

        it('does not mark spans coming from an empty SQS-polling as non-exportable', () => {
          const span = rootSpanWithAttributes({ 'aws.service.identifier': 'sqs' });
          const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({
            Messages: [],
          });

          responseHook(span, awsSdkResponse);

          expect(span.attributes).not.toHaveProperty('SKIP_EXPORT');
        });
      });

      describe("when LUMIGO_AUTO_FILTER_EMPTY_SQS is 'true'", () => {
        beforeEach(() => {
          process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS = 'true';
        });

        afterEach(() => {
          delete process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS;
        });

        it('marks spans coming from an empty SQS-polling as non-exportable', () => {
          const span = rootSpanWithAttributes({ 'aws.service.identifier': 'sqs' });
          const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({
            Messages: [],
          });

          responseHook(span, awsSdkResponse);

          expect(span.attributes).toHaveProperty('SKIP_EXPORT', true);
        });
      });
    });

    it('marks spans coming from other services as non-exportable and does not change their attributes', () => {
      const span = rootSpanWithAttributes({ 'aws.service.identifier': 'not-sqs' });
      const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({
        'some-thing': 'else',
      });

      responseHook(span, awsSdkResponse);

      expect(span.attributes).not.toHaveProperty('messaging.consume.body');
      expect(span.attributes).toHaveProperty('SKIP_EXPORT', true);
    });

    const awsResponseWithData = (data: unknown): AwsSdkResponseHookInformation => {
      return {
        response: {
          request: {
            commandInput: {},
            commandName: 'not used',
            serviceName: 'not used',
            region: 'us-west-2',
          },
          requestId: '1234',
          data,
        },
        moduleVersion: 'x.y.z',
      };
    };
  });

  describe('preRequestHook', () => {
    it('adds attributes to a span coming from SQS', () => {
      const span = rootSpanWithAttributes({ 'aws.service.identifier': 'sqs' });
      const awsSdkRequest: AwsSdkRequestHookInformation = awsRequestWithCommandInput({
        some: 'thing',
      });

      preRequestHook(span, awsSdkRequest);

      expect(span.attributes).toMatchObject({
        'messaging.publish.body': JSON.stringify(awsSdkRequest.request.commandInput),
      });
      expect(span.attributes).not.toHaveProperty('SKIP_EXPORT');
    });

    it('marks spans coming from other services as non-exportable and does not changes their attributes', () => {
      const span = rootSpanWithAttributes({ 'aws.service.identifier': 'not-sqs' });
      const awsSdkRequest: AwsSdkRequestHookInformation = awsRequestWithCommandInput({
        some: 'thing',
      });

      preRequestHook(span, awsSdkRequest);

      expect(span.attributes).not.toHaveProperty('messaging.publish.body');
      expect(span.attributes).toHaveProperty('SKIP_EXPORT', true);
    });

    const awsRequestWithCommandInput = (
      commandInput: Record<string, any>
    ): AwsSdkRequestHookInformation => {
      return {
        request: {
          commandInput,
          commandName: 'not used',
          serviceName: 'not used',
          region: 'not used',
        },
      };
    };
  });
});
