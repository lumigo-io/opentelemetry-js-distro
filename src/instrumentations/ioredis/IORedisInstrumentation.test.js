import LumigoIORedisInstrumentation from './IORedisInstrumentation';

describe('LumigoIORedisInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoIORedisInstrumentation = new LumigoIORedisInstrumentation();

  test('getInstrumentedModule should return "ioredis"', () => {
    expect(lumigoIORedisInstrumentation.getInstrumentedModule()).toEqual('ioredis');
  });
});
