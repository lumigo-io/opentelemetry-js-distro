import LumigoExpressInstrumentation from './ExpressInstrumentation';

describe('LumigoExpressInstrumentation', () => {
  let lumigoExpressInstrumentation = new LumigoExpressInstrumentation();

  test('getInstrumentedModule should return "express"', () => {
    expect(lumigoExpressInstrumentation.getInstrumentedModule()).toEqual('express');
  });

  test('getInstrumentation should return ExpressInstrumentation object', () => {
    expect(lumigoExpressInstrumentation.getInstrumentation()).toMatchObject({
      instrumentationName: 'opentelemetry-instrumentation-express',
      instrumentationVersion: expect.any(String),
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
        version: expect.any(String),
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

  test.skip('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install express', { stdio: 'inherit' });
    const express = require('express');

    expect(lumigoExpressInstrumentation.requireIfAvailable()).toEqual(express);
    child_process.execSync('npm uninstall express', { stdio: 'inherit' });
  });
});
