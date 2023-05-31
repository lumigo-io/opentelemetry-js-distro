import { getAwsServiceData } from './awsSpan';
import { Span } from '@opentelemetry/api';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';

describe('awsSpan', () => {
  test('getAwsServiceData parsing sqsd user-agent', () => {
    const requestData = {
      body: '',
    };
    const responseData = {
      body: '<?xml version="1.0"?><SendMessageResponse xmlns="http://queue.amazonaws.com/doc/2012-11-05/"><SendMessageResult><MessageId>85dc3997-b060-47bc-9d89-c754d7260dbd</MessageId><MD5OfMessageBody>c5cb6abef11b88049177473a73ed662f</MD5OfMessageBody></SendMessageResult><ResponseMetadata><RequestId>b6b5a045-23c6-5e3a-a54f-f7dd99f7b379</RequestId></ResponseMetadata></SendMessageResponse>',
    };
    const provider = new BasicTracerProvider();
    const root: Span = provider.getTracer('default').startSpan('root');
    root.setAttribute('http.user_agent', 'aws-sqsd/3.0.4');
    root.end();
    // @ts-ignore
    const awsServiceData = getAwsServiceData(requestData, responseData, root);

    expect(awsServiceData).toEqual({ messageId: '85dc3997-b060-47bc-9d89-c754d7260dbd' });
  });
});
