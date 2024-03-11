import LumigoExpressInstrumentation from './ExpressInstrumentation';

describe('LumigoExpressInstrumentation', () => {
  let lumigoExpressInstrumentation = new LumigoExpressInstrumentation();

  test('getInstrumentedModule should return "express"', () => {
    expect(lumigoExpressInstrumentation.getInstrumentedModule()).toEqual('express');
  });
});
