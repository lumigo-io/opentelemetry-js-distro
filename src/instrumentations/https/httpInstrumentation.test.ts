import LumigoHttpInstrumentation from './HttpInstrumentation';

describe('LumigoHttpInstrumentation', () => {
  let lumigoHttpInstrumentation = new LumigoHttpInstrumentation();

  test('getInstrumentedModule should return "http"', () => {
    expect(lumigoHttpInstrumentation.getInstrumentedModule()).toEqual('http');
  });
});
