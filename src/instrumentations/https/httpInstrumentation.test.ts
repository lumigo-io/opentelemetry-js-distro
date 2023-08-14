import LumigoHttpInstrumentation from './HttpInstrumentation';

describe('LumigoHttpInstrumentation', () => {
  let lumigoHttpInstrumentation = new LumigoHttpInstrumentation();

  test('getInstrumentedModule should return "http"', () => {
    expect(lumigoHttpInstrumentation.getInstrumentedModule()).toEqual('http');
  });

  // should not be skipped, see https://lumigo.atlassian.net/browse/RD-11195
  test.skip('requireIfAvailable should return the "http" module', () => {
    const http = require('http');
    expect(lumigoHttpInstrumentation.requireIfAvailable()).toEqual(http);
  });
});
