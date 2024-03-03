import LumigoRedisInstrumentation from './RedisInstrumentation';

describe('LumigoRedisInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoRedisInstrumentation = new LumigoRedisInstrumentation();

  test('getInstrumentedModule should return "redis"', () => {
    expect(lumigoRedisInstrumentation.getInstrumentedModules()).toEqual(['redis']);
  });
});
