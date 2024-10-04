import { SpanKind, SpanStatusCode } from '@opentelemetry/api';

export function getExpectedResourceAttributes() {
  return {
    'service.name': 'amqplib',
    'telemetry.sdk.language': 'nodejs',
    'telemetry.sdk.name': 'opentelemetry',
    'telemetry.sdk.version': expect.any(String),
    'framework': expect.toBeOneOf(['node', 'express']),
    'process.environ': expect.any(String),
    'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
    'process.pid': expect.any(Number),
    'process.executable.name': 'node',
    'process.runtime.description': 'Node.js',
    'process.runtime.name': 'nodejs',
    'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
  };
}

export function getExpectedSpan({
  nameSpanAttr,
  spanKind,
  resourceAttributes,
  host,
  topic,
  message,
}) {
  let messageKey;
  switch (spanKind) {
    case SpanKind.PRODUCER:
      messageKey = 'messaging.publish.body';
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
    parentId: expect.any(String),
    timestamp: expect.any(Number),
    duration: expect.any(Number),
    name: nameSpanAttr,
    kind: spanKind,
    resource: {
      attributes: resourceAttributes,
    },
    attributes: {
      'messaging.destination': '',
      'messaging.destination_kind': 'topic',
      'messaging.protocol': 'AMQP',
      'messaging.protocol_version': '0.9.1',
      'messaging.rabbitmq.routing_key': topic,
      [messageKey]: JSON.stringify(message),
      'messaging.system': 'rabbitmq',
      // the port is reported inconsistently, ignore it
      'messaging.url': expect.stringContaining(`amqp://${host}:`),
      'net.peer.name': host,
      'net.peer.port': expect.any(Number),
    },
    status: {
      code: SpanStatusCode.UNSET,
    },
    events: [],
  };
}

export function filterAmqplibSpans(spans, topic) {
  return spans.filter((span) => span.name.includes(topic));
}
