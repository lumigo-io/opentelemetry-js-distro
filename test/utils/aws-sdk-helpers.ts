import {Span} from '@opentelemetry/sdk-trace-base';
import type { SQS as SQSClient } from 'aws-sdk';

export const testAppQueryParams = ({ region, queueUrl, sqsPort }: { region: string, queueUrl: string, sqsPort: number }) =>
  Object.entries({
    region,
    sqsPort,
    queueUrl: encodeURIComponent(queueUrl)
  }).map(keyValue => keyValue.join('=')).join('&')

export const createTempQueue = async ({ sqsClient, sqsPort }: { sqsClient: SQSClient, sqsPort: number }) => {
  const queueName = `test-queue-${Math.random().toString(36).substring(7)}`;
  await sqsClient.createQueue({ QueueName: queueName }).promise()
  const queueUrl = `http://localhost:${sqsPort}/000000000000/${queueName}`

  return { queueUrl, queueName }
}

export const filterAwsSdkInstrumentationSpans = (spans: Span[]) =>
  spans.filter(span => {
    if (span.attributes['http.request.headers']) {
      const headers = JSON.parse(span.attributes['http.request.headers'] as string)
      return headers['user-agent']?.includes('aws-sdk')
    }

    return false
  })
