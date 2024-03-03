import LumigoAmqplibInstrumentation from './AmqplibInstrumentation';

describe('LumigoAmqplibInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoAmqplibInstrumentation = new LumigoAmqplibInstrumentation();

  test('getInstrumentedModule should return "amqplib"', () => {
    expect(lumigoAmqplibInstrumentation.getInstrumentedModules()).toEqual(['amqplib']);
  });
});
