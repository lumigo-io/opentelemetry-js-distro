import LumigoMongoDBInstrumentation from './MongoDBInstrumentation';
import child_process from 'child_process';

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
    const child_process = require('child_process');
    child_process.execSync('npm install mongodb', { stdio: 'inherit' });

    process.env.LUMIGO_DISABLE_MONGODB_INSTRUMENTATION = 'true';
    expect(lumigoMongoDBInstrumentation.isApplicable()).toEqual(false);
  });

  test('getInstrumentedModule should return "mongodb"', () => {
    expect(lumigoMongoDBInstrumentation.getInstrumentedModule()).toEqual('mongodb');
  });
});
