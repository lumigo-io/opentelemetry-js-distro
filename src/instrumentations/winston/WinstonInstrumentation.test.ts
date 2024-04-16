import LumigoWinstonInstrumentation from './WinstonInstrumentation';

describe('LumigoWinstonInstrumentation', () => {
  test('getInstrumentedModule should return "winston"', () => {
    expect(new LumigoWinstonInstrumentation().getInstrumentedModule()).toEqual('winston');
  });
});
