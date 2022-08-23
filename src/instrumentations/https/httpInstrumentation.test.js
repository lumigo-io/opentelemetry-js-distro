import LumigoHttpInstrumentation from './HttpInstrumentation';
import http from 'http';

describe('LumigoHttpInstrumentation', () => {
  let lumigoHttpInstrumentation = new LumigoHttpInstrumentation();

  test('getInstrumentationId should return "http"', () => {
    expect(lumigoHttpInstrumentation.getInstrumentationId()).toEqual('http');
  });

  test('getInstrumentation should return HttpInstrumentation object', () => {
    const ignoreConfig = ['169.254.123.45:5000/request'];
    expect(lumigoHttpInstrumentation.getInstrumentation(ignoreConfig)).toMatchObject({
      instrumentationName: '@opentelemetry/instrumentation-http',
      instrumentationVersion: '0.28.0',
      _config: {
        enabled: true,
        ignoreOutgoingUrls: ignoreConfig,
        ignoreIncomingPaths: ignoreConfig,
      },
      _diag: {
        _namespace: '@opentelemetry/instrumentation-http',
      },
      _tracer: {
        _provider: {},
        name: '@opentelemetry/instrumentation-http',
        version: '0.28.0',
      },
      _meter: {},
      _hooks: [
        {
          cache: {},
          _unhooked: false,
        },
        {
          cache: {},
          _unhooked: false,
        },
      ],
      _enabled: true,
      _modules: [
        {
          name: 'https',
          supportedVersions: ['*'],
          files: [],
        },
        {
          name: 'http',
          supportedVersions: ['*'],
          files: [],
        },
      ],
      _spanNotEnded: {},
      _version: expect.any(String),
      _headerCapture: {
        client: {},
        server: {},
      },
    });
  });

  test('requireIfAvailable should return required name', () => {
    const http = require('http');
    expect(lumigoHttpInstrumentation.requireIfAvailable()).toEqual(http);
  });
});
