import LumigoIORedisInstrumentation from './IORedisInstrumentation';

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
    // We've pre-installed ioredis in package.json
    process.env.LUMIGO_DISABLE_IOREDIS_INSTRUMENTATION = 'true';
    expect(lumigoIORedisInstrumentation.isApplicable()).toEqual(false);
  });
});
