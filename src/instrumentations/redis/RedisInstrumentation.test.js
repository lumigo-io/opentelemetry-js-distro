import LumigoRedisInstrumentation from './RedisInstrumentation';

describe('LumigoRedisInstrumentation', () => {
  const oldEnv = Object.assign({}, process.env);
  beforeEach(() => {
    process.env = { ...oldEnv };
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = { ...oldEnv };
  });

  let lumigoRedisInstrumentation = new LumigoRedisInstrumentation();

  test('disable redis instrumentation', () => {
    // We've pre-installed redis in package.json
    process.env.LUMIGO_DISABLE_REDIS_INSTRUMENTATION = 'true';
    expect(lumigoRedisInstrumentation.isApplicable()).toEqual(false);
  });

  test('getInstrumentedModule should return "redis and be applicable"', () => {
    expect(lumigoRedisInstrumentation.getInstrumentedModule()).toEqual('redis');
  });
});
