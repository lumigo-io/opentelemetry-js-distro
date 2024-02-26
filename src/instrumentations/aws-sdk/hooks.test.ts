import { BasicTracerProvider, Span } from '@opentelemetry/sdk-trace-base';
import { responseHook } from './hooks';
import type { AwsSdkResponseHookInformation } from '@opentelemetry/instrumentation-aws-sdk';

describe('aws-sdk instrumentation hooks', () => {
  describe('responseHook', () => {
    it('add attributes to a span coming from SQS', () => {
      const span = rootSpanWithAttributes({ 'aws.service.identifier': 'sqs' });
      const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({ Messages: [{ Body: "something" }] });

      responseHook(span, awsSdkResponse)

      expect(span.attributes).toMatchObject({"aws.service.identifier": "sqs"})
      expect(span.attributes).not.toHaveProperty('SKIP_EXPORT')
    })

    describe("filtering empty SQS responses", () => {
      describe("when LUMIGO_AUTO_FILTER_EMPTY_SQS is 'false'", () => {
        beforeEach(() => {
          process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS = 'false';
        })

        afterEach(() => {
          delete process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS;
        })

        it('does not mark spans coming from an empty SQS-polling as non-exportable', () => {
          const span = rootSpanWithAttributes({ 'aws.service.identifier': 'sqs' });
          const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({ Messages: [] });

          responseHook(span, awsSdkResponse);

          expect(span.attributes).not.toHaveProperty('SKIP_EXPORT');
        })
      })

      describe("when LUMIGO_AUTO_FILTER_EMPTY_SQS is 'true'", () => {
        beforeEach(() => {
          process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS = 'true';
        })

        afterEach(() => {
          delete process.env.LUMIGO_AUTO_FILTER_EMPTY_SQS;
        })

        it('marks spans coming from an empty SQS-polling as non-exportable', () => {
          const span = rootSpanWithAttributes({ 'aws.service.identifier': 'sqs' });
          const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({ Messages: [] });

          responseHook(span, awsSdkResponse);

          expect(span.attributes).toHaveProperty('SKIP_EXPORT', true);
        })
      })
    })

    it('mark spans coming from other services as non-exportable', () => {
      const span = rootSpanWithAttributes({ 'aws.service.identifier': 'not-sqs' });
      const awsSdkResponse: AwsSdkResponseHookInformation = awsResponseWithData({ "some-thing": "else" });

      responseHook(span, awsSdkResponse)

      expect(span.attributes).toMatchObject({})
      expect(span.attributes).toHaveProperty('SKIP_EXPORT', true)
    })
  })

  const rootSpanWithAttributes = (attributes: Record<string, any>): Span => {
    const provider = new BasicTracerProvider();
    const root = provider.getTracer('default').startSpan('root');
    root.setAttributes(attributes);

    return root as Span;
  };

  const awsResponseWithData = (data: unknown): AwsSdkResponseHookInformation => {
    return {
      response: {
        request: {
          commandInput: {},
          commandName: 'not used',
          serviceName: 'not used',
          region: 'us-west-2'
        },
        requestId: '1234',
        data
      },
      moduleVersion: 'x.y.z'
    }
  }
})