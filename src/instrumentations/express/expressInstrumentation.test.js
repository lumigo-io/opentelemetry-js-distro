import LumigoExpressInstrumentation from './ExpressInstrumentation';

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
          supportedVersions: expect.any(Array),
          files: [
            {
              supportedVersions: expect.any(Array),
              name: 'express/lib/router/layer.js',
            },
          ],
        },
      ],
    });
  });

  test('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install express');
    const express = require('express');

    expect(lumigoExpressInstrumentation.requireIfAvailable()).toEqual(express);
    child_process.execSync('npm uninstall express');
  });
});
