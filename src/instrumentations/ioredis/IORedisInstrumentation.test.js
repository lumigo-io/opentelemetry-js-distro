import LumigoIORedisInstrumentation from './IORedisInstrumentation';
import child_process from 'child_process';

describe('LumigoIORedisInstrumentation', () => {
  const oldEnv = Object.assign({}, process.env);

  beforeEach(() => {
    process.env = { ...oldEnv };
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = { ...oldEnv };
  });

  let lumigoIORedisInstrumentation = new LumigoIORedisInstrumentation();

  test('getInstrumentedModule should return "ioredis"', () => {
    expect(lumigoIORedisInstrumentation.getInstrumentedModule()).toEqual('ioredis');
  });

  test('disable ioredis instrumentation', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install ioredis', { stdio: 'inherit' });

    process.env.LUMIGO_DISABLE_IOREDIS_INSTRUMENTATION = 'true';
    expect(lumigoIORedisInstrumentation.isApplicable()).toEqual(false);
  });
});
