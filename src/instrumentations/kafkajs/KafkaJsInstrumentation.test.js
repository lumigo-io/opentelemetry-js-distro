import LumigoKafkaJsInstrumentation from './KafkaJsInstrumentation';

describe('LumigoKafkaJsInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoKafkaJsInstrumentation = new LumigoKafkaJsInstrumentation();

  test('getInstrumentedModule should return "kafkajs"', () => {
    expect(lumigoKafkaJsInstrumentation.getInstrumentedModule()).toEqual('kafkajs');
  });
});
