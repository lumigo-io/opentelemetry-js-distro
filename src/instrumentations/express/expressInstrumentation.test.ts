import LumigoExpressInstrumentation from './ExpressInstrumentation';

describe('LumigoExpressInstrumentation', () => {
  let lumigoExpressInstrumentation = new LumigoExpressInstrumentation();

  test('getInstrumentedModule should return "express"', () => {
    expect(lumigoExpressInstrumentation.getInstrumentedModules()).toEqual(['express']);
  });
});
