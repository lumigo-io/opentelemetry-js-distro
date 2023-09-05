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

const CLIENT_CONNECTION_SPAN = 'prisma:engine:connection';
const QUERY_CONNECTION_SPANS = ['prisma:client:serialize', 'prisma:client:connect'];

export function getQuerySpans(spans) {
  return spans.filter((span) => span.name != CLIENT_CONNECTION_SPAN);
}

export function hasExpectedClientConnectionSpans({
  spans,
  engine,
  expectedInstantiations,
  expectedQueries,
}) {
  const resourceAttributes = getExpectedResourceAttributes();
  const engineConnectionSpans = spans.filter((span) => span.name == CLIENT_CONNECTION_SPAN);

  // depending on the client version, we can expect an engine connection span on
  // client instantiation in addition to on each query. as such, the number of
  // client instantiation spans is treated as optional
  try {
    expect(engineConnectionSpans.length).toBe(expectedInstantiations + expectedQueries);
  } catch (e) {
    expect(engineConnectionSpans.length).toBe(expectedQueries);
  }

  for (const engineConnectionSpan of engineConnectionSpans) {
    expect(engineConnectionSpan).toMatchObject(
      getExpectedSpan({
        name: CLIENT_CONNECTION_SPAN,
        resourceAttributes,
        attributes: {
          'db.type': engine.name,
        },
      })
    );
  }

  return true;
}

export function getQueryOperationSpans(spans) {
  return spans.filter((span) => QUERY_CONNECTION_SPANS.indexOf(span.name) < 0);
}

export function hasExpectedQueryConnectionSpans(spans, engine) {
  const resourceAttributes = getExpectedResourceAttributes();
  const connectionSpans = spans.filter((span) => QUERY_CONNECTION_SPANS.indexOf(span.name) > -1);

  for (const spanName of QUERY_CONNECTION_SPANS) {
    expect(getSpanByName(connectionSpans, spanName)).toMatchObject(
      getExpectedSpan({
        name: spanName,
        resourceAttributes,
        attributes: {},
      })
    );
  }

  return true;
}
