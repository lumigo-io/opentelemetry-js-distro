import { SpanKind, SpanStatusCode } from '@opentelemetry/api';

export function getExpectedResourceAttributes() {
  return {
    'service.name': 'ioredis',
    'telemetry.sdk.language': 'nodejs',
    'telemetry.sdk.name': 'opentelemetry',
    'telemetry.sdk.version': expect.any(String),
    'framework': expect.toBeOneOf(['node', 'express']),
    'process.environ': expect.any(String),
    'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
    'process.pid': expect.any(Number),
    'process.executable.name': 'node',
    'process.executable.path': expect.any(String),
    'process.command_args': expect.any(Array),
    'process.runtime.description': 'Node.js',
    'process.runtime.name': 'nodejs',
    'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
    'process.owner': expect.any(String),
    'process.command': expect.any(String),
  };
}

export function getExpectedSpan({
  name,
  resourceAttributes,
  attributes,
}: {
  name: string,
  resourceAttributes: any,
  attributes: any,
}) {
  const expectedSpan = {
    traceId: expect.any(String),
    id: expect.any(String),
    parentId: expect.any(String),
    timestamp: expect.any(Number),
    duration: expect.any(Number),
    name,
    kind: SpanKind.CLIENT,
    resource: {
      _attributes: resourceAttributes,
      asyncAttributesPending: expect.any(Boolean),
      _syncAttributes: expect.any(Object),
    },
    attributes,
    status: {
      code: SpanStatusCode.UNSET,
    },
    events: [],
  };

  return expectedSpan;
}

export function filterRedisSpans(spans) {
  return spans.filter((span) => span.attributes['db.system'] == 'redis');
}

const CLIENT_CONNECTION_SPANS = ['connect', 'info', 'quit'];

export function getQuerySpans(spans) {
  return spans.filter((span) => CLIENT_CONNECTION_SPANS.indexOf(span.name) < 0);
}

export function hasExpectedClientConnectionSpans(spans) {
  const connectionSpans = spans.filter((span) => CLIENT_CONNECTION_SPANS.indexOf(span.name) > -1);
  expect(connectionSpans).toHaveLength(3);

  const resourceAttributes = getExpectedResourceAttributes();

  expect(connectionSpans[0]).toMatchObject(
    getExpectedSpan({
      name: 'connect',
      resourceAttributes,
      attributes: {
        'db.system': 'redis',
        'db.statement': 'connect',
        'net.peer.name': expect.any(String),
        'net.peer.port': expect.any(Number),
        'db.connection_string': expect.any(String),
      },
    })
  );

  expect(connectionSpans[1]).toMatchObject(
    getExpectedSpan({
      name: 'info',
      resourceAttributes,
      attributes: {
        'db.system': 'redis',
        'db.statement': JSON.stringify('info'),
        'db.response.body': expect.any(String),
        'net.peer.name': expect.any(String),
        'net.peer.port': expect.any(Number),
        'db.connection_string': expect.any(String),
      },
    })
  );

  expect(connectionSpans[2]).toMatchObject(
    getExpectedSpan({
      name: 'quit',
      resourceAttributes,
      attributes: {
        'db.system': 'redis',
        'db.statement': JSON.stringify('quit'),
        'db.response.body': JSON.stringify('OK'),
        'net.peer.name': expect.any(String),
        'net.peer.port': expect.any(Number),
        'db.connection_string': expect.any(String),
      },
    })
  );

  return true;
}
