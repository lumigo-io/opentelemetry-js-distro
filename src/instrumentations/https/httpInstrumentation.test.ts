import LumigoHttpInstrumentation from './HttpInstrumentation';

describe('LumigoHttpInstrumentation', () => {
  let lumigoHttpInstrumentation = new LumigoHttpInstrumentation();

  test('getInstrumentedModule should return "http"', () => {
    expect(lumigoHttpInstrumentation.getInstrumentedModule()).toEqual('http');
  });

  test('requireIfAvailable should return the "http" module', () => {
    const http = require('http');
    expect(lumigoHttpInstrumentation.requireIfAvailable()).toEqual(http);
  });
});
