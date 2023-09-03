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

export function getExpectedSpan({ name, attributes }) {
  return {
    traceId: expect.any(String),
    id: expect.any(String),
    timestamp: expect.any(Number),
    duration: expect.any(Number),
    name: name,
    kind: SpanKind.INTERNAL,
    resource: {
      attributes: getExpectedResourceAttributes(),
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

export function findFirstDbQueryIndex(spans) {
  return spans.findIndex((span) => span.name === 'prisma:engine:db_query');
}

export function getOperationSpans(spans) {
  return spans.slice(3);
}

export function hasExpectedConnectionSpans(spans, engine) {
  const connectionSpans = spans.slice(0, 3);

  expect(connectionSpans).toHaveLength(3);

  expect(getSpanByName(connectionSpans, 'prisma:client:serialize')).toMatchObject(
    getExpectedSpan({
      name: 'prisma:client:serialize',
      attributes: {},
    })
  );

  expect(getSpanByName(connectionSpans, 'prisma:client:connect')).toMatchObject(
    getExpectedSpan({
      name: 'prisma:client:connect',
      attributes: {},
    })
  );

  expect(getSpanByName(connectionSpans, 'prisma:engine:connection')).toMatchObject(
    getExpectedSpan({
      name: 'prisma:engine:connection',
      attributes: {
        'db.type': engine.name,
      },
    })
  );

  return true;
}
