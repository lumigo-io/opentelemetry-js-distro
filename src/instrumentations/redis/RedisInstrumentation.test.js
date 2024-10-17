import LumigoRedisInstrumentation from './RedisInstrumentation';
import child_process from 'child_process';

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
    const child_process = require('child_process');
    child_process.execSync('npm install redis@4.0.0', { stdio: 'inherit' });

    expect(lumigoRedisInstrumentation.isApplicable()).toEqual(true);

    process.env.LUMIGO_DISABLE_REDIS_INSTRUMENTATION = 'true';
    expect(lumigoRedisInstrumentation.isApplicable()).toEqual(false);
  });

  test('getInstrumentedModule should return "redis and be applicable"', () => {
    expect(lumigoRedisInstrumentation.getInstrumentedModule()).toEqual('redis');
  });
});
