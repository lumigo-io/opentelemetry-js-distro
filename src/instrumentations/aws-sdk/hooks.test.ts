import { responseHook, preRequestHook, sqsProcessHook } from './hooks';
import type {
  AwsSdkRequestHookInformation,
  AwsSdkResponseHookInformation,
} from '@opentelemetry/instrumentation-aws-sdk';
import { rootSpanWithAttributes } from '../../../test/utils/spans';
import { getSpanAttributeMaxLength } from '../../utils';
import { SpanKind } from '@opentelemetry/api';

describe('aws-sdk instrumentation hooks', () => {
  describe('responseHook', () => {
    test('adds custom attributes to an SQS.ReceiveMessage span', () => {
      const span = rootSpanWithAttributes({
        'rpc.service': 'SQS',
        'rpc.method': 'ReceiveMessage',
        'messaging.destination': 'some-queue-name',
      });
      const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({
        Messages: [{ Body: 'something' }],
      });

      responseHook(span, awsSdkResponse);

      expect(span.attributes).toMatchObject({
        'messaging.consume.body': JSON.stringify(awsSdkResponse.response.data),
        'messaging.operation': 'ReceiveMessage',
        'aws.queue.name': 'some-queue-name',
      });
      expect(span.attributes['SKIP_EXPORT']).toBeUndefined();
    });

    test('does not modify a non SQS.ReceiveMessage span', () => {
      const span = rootSpanWithAttributes({ 'rpc.service': 'SQS', 'rpc.method': 'SomeThingElse' });
      const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({
        Messages: [{ Body: 'something' }],
      });

      responseHook(span, awsSdkResponse);

      expect(span.attributes['messaging.consume.body']).toBeUndefined();
      expect(span.attributes['SKIP_EXPORT']).toBeUndefined();
    });

    describe('filtering empty SQS responses', () => {
      describe("when LUMIGO_AUTO_FILTER_EMPTY_SQS is 'false'", () => {
        test('does not mark spans coming from an empty SQS-polling as non-exportable', () => {
          jest.isolateModules(() => {
            process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS = 'false';

            const span = rootSpanWithAttributes({
              'rpc.service': 'SQS',
              'rpc.method': 'ReceiveMessage',
            });
            const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({
              Messages: [],
            });

            responseHook(span, awsSdkResponse);

            expect(span.attributes['SKIP_EXPORT']).toBeUndefined();
          });
        });
      });

      describe("when LUMIGO_AUTO_FILTER_EMPTY_SQS is 'true'", () => {
        test('marks spans coming from an empty SQS-polling as non-exportable', () => {
          jest.isolateModules(() => {
            process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS = 'true';

            const span = rootSpanWithAttributes({
              'rpc.service': 'SQS',
              'rpc.method': 'ReceiveMessage',
            });
            const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({
              Messages: [],
            });

            responseHook(span, awsSdkResponse);

            expect(span.attributes).toHaveProperty('SKIP_EXPORT', true);
          });
        });

        test('ignores non SQS-polling empty responses', () => {
          jest.isolateModules(() => {
            process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS = 'true';

            const span = rootSpanWithAttributes({
              'rpc.service': 'SQS',
              'rpc.method': 'SomeThingElse',
            });
            const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({
              Messages: [],
            });

            responseHook(span, awsSdkResponse);

            expect(span.attributes['SKIP_EXPORT']).toBeUndefined();
          });
        });
      });
    });

    test('marks spans coming from other services as non-exportable', () => {
      const span = rootSpanWithAttributes({ 'aws.service.identifier': 'not-sqs' });
      const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({
        'some-thing': 'else',
      });

      responseHook(span, awsSdkResponse);

      expect(span.attributes).toHaveProperty('SKIP_EXPORT', true);
    });

    test('truncates and scrubs the SQS message body for the ReceiveMessage operations', () => {
      const secretKey = 'shush';
      const secretValue = 'this is top secret';

      // node-core loads the value of LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_BODIES on require() time,
      // therefore we must use isolateModules and re-set its value so the change will take effect
      jest.isolateModules(() => {
        process.env['LUMIGO_SECRET_MASKING_REGEX_HTTP_RESPONSE_BODIES'] = JSON.stringify([
          `.*${secretKey}.*`,
        ]);

        const span = rootSpanWithAttributes({
          'rpc.service': 'SQS',
          'rpc.method': 'ReceiveMessage',
        });
        const payload = {
          [secretKey]: secretValue,
          'non-secret-key': 'a'.repeat(getSpanAttributeMaxLength() * 2),
        };
        const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData(payload);

        const responseHook = jest.requireActual('./hooks').responseHook;
        responseHook(span, awsSdkResponse);

        expect(span.attributes['messaging.consume.body']).not.toContain(secretValue);
        expect(span.attributes['messaging.consume.body']!.toString().length).toBeLessThanOrEqual(
          JSON.stringify(payload).length
        );
      });
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
    test.each(['SendMessage', 'SendMessageBatch'])(
      'adds attributes to a span coming from an SQS publish operation',
      (sqsOperation) => {
        const span = rootSpanWithAttributes({
          'rpc.service': 'SQS',
          'rpc.method': sqsOperation,
          'messaging.destination': 'some-queue-name',
        });
        const awsSdkRequest: AwsSdkRequestHookInformation = awsRequestWithCommandInput({
          some: 'thing',
        });

        preRequestHook(span, awsSdkRequest);

        expect(span.attributes).toMatchObject({
          'messaging.publish.body': JSON.stringify(awsSdkRequest.request.commandInput),
          'messaging.operation': sqsOperation,
          'aws.queue.name': 'some-queue-name',
        });
        expect(span.attributes['SKIP_EXPORT']).toBeUndefined();
      }
    );

    test('marks spans coming from other services as non-exportable', () => {
      const span = rootSpanWithAttributes({ 'aws.service.identifier': 'not-sqs' });
      const awsSdkRequest: AwsSdkRequestHookInformation = awsRequestWithCommandInput({
        some: 'thing',
      });

      preRequestHook(span, awsSdkRequest);

      expect(span.attributes).toHaveProperty('SKIP_EXPORT', true);
    });

    describe('scrubbing the request body', () => {
      const secretKey = 'shhhh';
      const secretValue = 'some-secret';

      test.each(['SendMessage', 'SendMessageBatch'])(
        'truncates and scrubs the SQS message body for %s operations',
        (sqsOperation) => {
          // node-core loads the value of LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_BODIES on require() time,
          // therefore we must use isolateModules and re-set its value so the change will take effect
          jest.isolateModules(() => {
            process.env['LUMIGO_SECRET_MASKING_REGEX_HTTP_REQUEST_BODIES'] = JSON.stringify([
              `.*${secretKey}.*`,
            ]);

            const span = rootSpanWithAttributes({
              'rpc.service': 'SQS',
              'rpc.method': sqsOperation,
            });
            const payload = {
              [secretKey]: secretValue,
              'non-secret-key': 'a'.repeat(getSpanAttributeMaxLength() * 2),
            };
            const awsSdkRequest: AwsSdkRequestHookInformation = awsRequestWithCommandInput(payload);
            const preRequestHook = jest.requireActual('./hooks').preRequestHook;
            preRequestHook(span, awsSdkRequest);

            expect(span.attributes['messaging.publish.body']).not.toContain(secretValue);
            expect(
              span.attributes['messaging.publish.body']!.toString().length
            ).toBeLessThanOrEqual(JSON.stringify(payload).length);
          });
        }
      );
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

  describe('sqsProcessHook', () => {
    test('sets the span kind and attributes for tracing-ingestion', () => {
      // aws-sdk instrumentation does not set the span type to internal, but to consumer for some reason
      const sqsProcessSpan = rootSpanWithAttributes(
        {
          'messaging.message_id': 'this will fail tracing-ingestion by causing an infinite loop',
        },
        SpanKind.CONSUMER
      );

      sqsProcessHook(sqsProcessSpan);

      expect(sqsProcessSpan.kind).toBe(SpanKind.INTERNAL);
      expect(sqsProcessSpan.attributes['messaging.message_id']).toBeUndefined();
    });
  });
});
