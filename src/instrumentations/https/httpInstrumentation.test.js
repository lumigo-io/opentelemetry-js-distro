import LumigoHttpInstrumentation from './HttpInstrumentation';
import http from 'http';

describe('LumigoHttpInstrumentation', () => {
  let lumigoHttpInstrumentation = new LumigoHttpInstrumentation();

  test('getInstrumentationId should return "http"', () => {
    expect(lumigoHttpInstrumentation.getInstrumentationId()).toEqual('http');
  });

  test('getInstrumentation should return HttpInstrumentation object', () => {
    const ignoreConfig = [/169\.254\.\d+\.\d+.*/gm];

    expect(lumigoHttpInstrumentation.getInstrumentation()).toMatchObject({
      instrumentationName: '@opentelemetry/instrumentation-http',
      instrumentationVersion: expect.any(String),
      _config: {
        enabled: true,
        ignoreOutgoingUrls: expect.arrayContaining(ignoreConfig),
        ignoreIncomingPaths: [],
      },
      _diag: {
        _namespace: '@opentelemetry/instrumentation-http',
      },
      _tracer: {
        _provider: {},
        name: '@opentelemetry/instrumentation-http',
        version: expect.any(String),
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
