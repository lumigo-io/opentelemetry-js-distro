import LumigoExpressInstrumentation from './ExpressInstrumentation';
const express = require('express');

describe('LumigoExpressInstrumentation', () => {
  let lumigoExpressInstrumentation = new LumigoExpressInstrumentation();

  test('getInstrumentationId should return "express"', () => {
    expect(lumigoExpressInstrumentation.getInstrumentationId()).toEqual('express');
  });

  test('getInstrumentation should return ExpressInstrumentation object', () => {
    expect(lumigoExpressInstrumentation.getInstrumentation()).toMatchObject({
      instrumentationName: 'opentelemetry-instrumentation-express',
      instrumentationVersion: '0.28.0',
      _config: {
        enabled: true,
        includeHttpAttributes: true,
      },
      _diag: {
        _namespace: 'opentelemetry-instrumentation-express',
      },
      _tracer: {
        _provider: {},
        name: 'opentelemetry-instrumentation-express',
        version: '0.28.0',
      },
      _meter: {},
      _hooks: [
        {
          cache: {},
          _unhooked: false,
        },
      ],
      _enabled: true,
      _modules: [
        {
          name: 'express',
          supportedVersions: ['^4.9.0'],
          files: [
            {
              supportedVersions: ['^4.9.0'],
              name: 'express/lib/router/layer.js',
            },
          ],
        },
      ],
    });
  });

  test('requireIfAvailable should return required name', () => {
    const express = require('express');
    expect(lumigoExpressInstrumentation.requireIfAvailable()).toEqual(express);
  });
});
