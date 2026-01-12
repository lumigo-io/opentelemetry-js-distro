import LumigoMongoDBInstrumentation from './MongoDBInstrumentation';

describe('LumigoMongoDBInstrumentation', () => {
  const oldEnv = Object.assign({}, process.env);
  beforeEach(() => {
    process.env = { ...oldEnv };
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = { ...oldEnv };
  });

  let lumigoMongoDBInstrumentation = new LumigoMongoDBInstrumentation();

  test('disable mongodb instrumentation', () => {
    // We've pre-installed mongodb in package.json
    process.env.LUMIGO_DISABLE_MONGODB_INSTRUMENTATION = 'true';
    expect(lumigoMongoDBInstrumentation.isApplicable()).toEqual(false);
  });

  test('getInstrumentedModule should return "mongodb"', () => {
    expect(lumigoMongoDBInstrumentation.getInstrumentedModule()).toEqual('mongodb');
  });
});
