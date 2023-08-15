import { SpanKind, SpanStatusCode } from '@opentelemetry/api';

export function getExpectedResourceAttributes() {
  return {
    'service.name': 'kafkajs',
    'telemetry.sdk.language': 'nodejs',
    'telemetry.sdk.name': 'opentelemetry',
    'telemetry.sdk.version': expect.any(String),
    framework: 'node',
    'process.environ': expect.any(String),
    'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
    'process.pid': expect.any(Number),
    'process.executable.name': 'node',
    'process.runtime.description': 'Node.js',
    'process.runtime.name': 'nodejs',
    'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
  };
}

export function getExpectedSpan({ spanKind, resourceAttributes, host, topic, message }) {
  let messageKey;
  switch (spanKind) {
    case SpanKind.PRODUCER:
      messageKey = 'messaging.produce.body';
      break;
    case SpanKind.CONSUMER:
      messageKey = 'messaging.consume.body';
      break;
    default:
      throw new Error('spanKind must be either SpanKind.PRODUCER or SpanKind.CONSUMER');
  }
  return {
    traceId: expect.any(String),
    id: expect.any(String),
    timestamp: expect.any(Number),
    duration: expect.any(Number),
    name: topic,
    kind: spanKind,
    resource: {
      attributes: resourceAttributes,
    },
    attributes: {
      'messaging.destination': topic,
      'messaging.destination_kind': 'topic',
      [messageKey]: JSON.stringify(message),
      'messaging.system': 'kafka',
    },
    status: {
      code: SpanStatusCode.UNSET,
    },
    events: [],
  };
}

export function filterKafkaJsSpans(spans, topic) {
  return spans.filter((span) => {
    return span.name == topic && span.attributes['messaging.destination'] == topic;
  });
}

export function filterKafkaJsProduceSpans(spans) {
  return spans.filter((span) => span.kind == SpanKind.PRODUCER);
}

export function filterKakfkaConsumeSpans(spans) {
  return spans.filter((span) => span.kind == SpanKind.CONSUMER);
}
