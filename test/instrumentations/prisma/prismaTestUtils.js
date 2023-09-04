import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { getSpanByName } from '../../utils/spans';

export function getExpectedResourceAttributes() {
  return {
    'service.name': 'prisma',
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

export function getExpectedSpan({ name, resourceAttributes, attributes }) {
  return {
    traceId: expect.any(String),
    id: expect.any(String),
    timestamp: expect.any(Number),
    duration: expect.any(Number),
    name: name,
    kind: SpanKind.INTERNAL,
    resource: {
      attributes: resourceAttributes,
    },
    attributes: attributes,
    status: {
      code: SpanStatusCode.UNSET,
    },
    events: [],
  };
}

export function filterPrismaSpans(spans) {
  return spans.filter((span) => span.name.indexOf('prisma:') === 0);
}

const CONNECTION_SPANS = [
  'prisma:client:serialize',
  'prisma:client:connect',
  'prisma:engine:connection',
];

export function getOperationSpans(spans) {
  return spans.filter((span) => CONNECTION_SPANS.indexOf(span.name) < 0);
}

export function hasExpectedConnectionSpans(spans, engine) {
  const resourceAttributes = getExpectedResourceAttributes();
  const connectionSpans = spans.filter((span) => CONNECTION_SPANS.indexOf(span.name) > -1);

  expect(connectionSpans).toHaveLength(3);

  expect(getSpanByName(connectionSpans, 'prisma:client:serialize')).toMatchObject(
    getExpectedSpan({
      name: 'prisma:client:serialize',
      resourceAttributes,
      attributes: {},
    })
  );

  expect(getSpanByName(connectionSpans, 'prisma:client:connect')).toMatchObject(
    getExpectedSpan({
      name: 'prisma:client:connect',
      resourceAttributes,
      attributes: {},
    })
  );

  expect(getSpanByName(connectionSpans, 'prisma:engine:connection')).toMatchObject(
    getExpectedSpan({
      name: 'prisma:engine:connection',
      resourceAttributes,
      attributes: {
        'db.type': engine.name,
      },
    })
  );

  return true;
}
