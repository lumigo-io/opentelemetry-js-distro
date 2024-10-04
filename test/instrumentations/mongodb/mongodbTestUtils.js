import { SpanKind, SpanStatusCode } from '@opentelemetry/api';

export function getExpectedResourceAttributes() {
  return {
    'service.name': 'mongodb',
    'telemetry.sdk.language': 'nodejs',
    'telemetry.sdk.name': 'opentelemetry',
    'telemetry.sdk.version': expect.any(String),
    'framework': expect.toBeOneOf(['node', 'express']),
    'process.environ': expect.any(String),
    'lumigo.distro.version': expect.stringMatching(/1\.\d+\.\d+/),
    'process.executable.name': 'node',
    'process.executable.path': expect.any(String),
    'process.owner': expect.any(String),
    'process.pid': expect.any(Number),
    'process.runtime.description': 'Node.js',
    'process.runtime.name': 'nodejs',
    'process.runtime.version': expect.stringMatching(/\d+\.\d+\.\d+/),
  };
}

export function getExpectedSpan(nameSpanAttr, resourceAttributes, dbStatement) {
  return {
    traceId: expect.any(String),
    id: expect.any(String),
    parentId: expect.any(String),
    timestamp: expect.any(Number),
    duration: expect.any(Number),
    name: nameSpanAttr,
    kind: SpanKind.CLIENT,
    resource: {
      _attributes: resourceAttributes,
      asyncAttributesPending: expect.any(Boolean),
      _syncAttributes: expect.any(Object),
    },
    attributes: {
      'db.system': 'mongodb',
      'db.name': 'myProject',
      'db.mongodb.collection': 'insertOne',
      "db.operation": "insert",
      "db.connection_string": expect.any(String),
      "net.peer.name": expect.any(String),
      "net.peer.port": expect.any(String),
      'db.statement': dbStatement,
    },
    status: {
      code: SpanStatusCode.UNSET,
    },
    events: [],
  };
}

export function getExpectedSpanWithParent(
  nameSpanAttr,
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
    kind: SpanKind.CLIENT,
    resource: {
      _attributes: resourceAttributes,
    },
    attributes: {
      'db.system': 'mongodb',
      'db.name': 'myProject',
      'db.mongodb.collection': dbCollection,
      'db.statement': dbStatement,
    },
    status: {
      code: SpanStatusCode.UNSET,
    },
    events: [],
  };
}

export function filterMongoSpans(spans) {
  return spans.filter(
    (span) => span.name.includes('mongodb') && !span.name.includes('mongodb.isMaster')
  );
}
