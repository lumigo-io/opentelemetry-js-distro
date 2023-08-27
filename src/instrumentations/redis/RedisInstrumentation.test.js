import LumigoRedisInstrumentation from './RedisInstrumentation';

describe('LumigoRedisInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoRedisInstrumentation = new LumigoRedisInstrumentation();

  test('getInstrumentedModule should return "redis"', () => {
    expect(lumigoRedisInstrumentation.getInstrumentedModule()).toEqual('redis');
  });

  // should not be skipped, see https://lumigo.atlassian.net/browse/RD-11195
  test.skip('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install redis', { stdio: 'inherit' });
    const redis = require('redis');

    expect(lumigoRedisInstrumentation.requireIfAvailable()).toEqual(redis);
    child_process.execSync('npm uninstall redis', { stdio: 'inherit' });
  });
});
