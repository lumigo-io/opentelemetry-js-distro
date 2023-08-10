export function getExpectedResourceAttributes() {
  return {
    'service.name': 'amqplib',
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

export function getExpectedSpan({ nameSpanAttr, spanKind, resourceAttributes, host, port }) {
  return {
    traceId: expect.any(String),
    id: expect.any(String),
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
      'messaging.rabbitmq.routing_key': 'test-topic-roundtrip',
      'messaging.system': 'rabbitmq',
      'messaging.url': expect.stringContaining(`amqp://${host}:`), //`amqp://${host}:${port}`,
      'net.peer.name': host,
      'net.peer.port': expect.any(Number),
    },
    status: {
      code: 0,
    },
    events: [],
  };
}

export function getExpectedSpanWithParent(
  nameSpanAttr,
  spanKind,
  resourceAttributes,
  dbStatement,
  dbCollection = 'insertOne'
) {
  return {
    traceId: expect.any(String),
    parentId: expect.any(String),
    id: expect.any(String),
    timestamp: expect.any(Number),
    duration: expect.any(Number),
    name: nameSpanAttr,
    kind: spanKind,
    resource: {
      attributes: resourceAttributes,
    },
    attributes: {
      'db.system': 'mongodb',
      'db.name': 'myProject',
      'db.mongodb.collection': dbCollection,
      'db.statement': dbStatement,
    },
    status: {
      code: 0,
    },
    events: [],
  };
}

export function filterAmqplibSpans(spans, topic) {
  return spans.filter((span) => span.name.includes(topic));
}
