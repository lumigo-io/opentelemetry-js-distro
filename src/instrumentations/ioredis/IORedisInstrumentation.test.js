import LumigoIORedisInstrumentation from './IORedisInstrumentation';

describe('LumigoIORedisInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoIORedisInstrumentation = new LumigoIORedisInstrumentation();

  test('getInstrumentedModule should return "ioredis"', () => {
    expect(lumigoIORedisInstrumentation.getInstrumentedModule()).toEqual('ioredis');
  });

  // should not be skipped, see https://lumigo.atlassian.net/browse/RD-11195
  test.skip('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install ioredis', { stdio: 'inherit' });
    const redis = require('ioredis');

    expect(lumigoIORedisInstrumentation.requireIfAvailable()).toEqual(redis);
    child_process.execSync('npm uninstall ioredis', { stdio: 'inherit' });
  });
});
