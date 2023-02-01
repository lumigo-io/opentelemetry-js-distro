import LumigoExpressInstrumentation from './ExpressInstrumentation';

describe('LumigoExpressInstrumentation', () => {
  let lumigoExpressInstrumentation = new LumigoExpressInstrumentation();

  test('getInstrumentedModule should return "express"', () => {
    expect(lumigoExpressInstrumentation.getInstrumentedModule()).toEqual('express');
  });

  test.skip('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install express', { stdio: 'inherit' });
    const express = require('express');

    expect(lumigoExpressInstrumentation.requireIfAvailable()).toEqual(express);
    child_process.execSync('npm uninstall express', { stdio: 'inherit' });
  });
});
