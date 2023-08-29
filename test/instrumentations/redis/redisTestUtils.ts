import { SpanKind, SpanStatusCode } from '@opentelemetry/api';

export function getExpectedResourceAttributes() {
  return {
    'service.name': 'redis',
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

export function getExpectedSpan({
  nameSpanAttr,
  resourceAttributes,
  host,
  dbStatement = undefined,
  responseBody = undefined,
}: {
  nameSpanAttr: string,
  resourceAttributes: any,
  host: string,
  dbStatement?: string,
  responseBody?: unknown,
}) {
  const expectedSpan = {
    traceId: expect.any(String),
    id: expect.any(String),
    timestamp: expect.any(Number),
    duration: expect.any(Number),
    name: nameSpanAttr,
    kind: SpanKind.CLIENT,
    resource: {
      attributes: resourceAttributes,
    },
    attributes: {
      'db.system': 'redis',
      'net.peer.name': host,
      'net.peer.port': expect.any(Number),
    },
    status: {
      code: SpanStatusCode.UNSET,
    },
    events: [],
  };
  if (dbStatement) {
    expectedSpan.attributes['db.statement'] = JSON.stringify(dbStatement);
  }
  if (responseBody) {
    expectedSpan.attributes['redis.response.body'] = JSON.stringify(responseBody);
  }

  return expectedSpan;
}

export function filterRedisSpans(spans) {
  return spans.filter((span) => span.name.indexOf('redis-') == 0);
}
