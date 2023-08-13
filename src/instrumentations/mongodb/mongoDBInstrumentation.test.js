import LumigoMongoDBInstrumentation from './MongoDBInstrumentation';

describe('LumigoMongoDBInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoMongoDBInstrumentation = new LumigoMongoDBInstrumentation();

  test('getInstrumentedModule should return "mongodb"', () => {
    expect(lumigoMongoDBInstrumentation.getInstrumentedModule()).toEqual('mongodb');
  });

  test('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install mongodb', { stdio: 'inherit' });
    const mongodb = require('mongodb');

    expect(lumigoMongoDBInstrumentation.requireIfAvailable()).toEqual(mongodb);
    child_process.execSync('npm uninstall mongodb', { stdio: 'inherit' });
  });
});
