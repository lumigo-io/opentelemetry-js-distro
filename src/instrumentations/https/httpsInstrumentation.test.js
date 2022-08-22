import LumigoHttpsInstrumentation from './HttpsInstrumentation';
import https from 'https';

describe('LumigoHttpsInstrumentation', () => {
  let lumigoHttpsInstrumentation = new LumigoHttpsInstrumentation();

  test('getInstrumentationId should return "https"', () => {
    expect(lumigoHttpsInstrumentation.getInstrumentationId()).toEqual('https');
  });

  test('getInstrumentation should return HttpInstrumentation object', () => {
    const ignoreConfig = ['169.250.188.45:5100/invoke-request'];
    expect(lumigoHttpsInstrumentation.getInstrumentation(ignoreConfig)).toMatchObject({
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
      _version: '12.9.0',
      _headerCapture: {
        client: {},
        server: {},
      },
    });
  });

  test('requireIfAvailable should return required name', () => {
    const https = require('https');
    expect(lumigoHttpsInstrumentation.requireIfAvailable()).toEqual(https);
  });
});
