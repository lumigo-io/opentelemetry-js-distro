import LumigoMongoDBInstrumentation from './MongoDBInstrumentation';

describe('LumigoMongoDBInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoMongoDBInstrumentation = new LumigoMongoDBInstrumentation();

  test('getInstrumentedModule should return "mongodb"', () => {
    expect(lumigoMongoDBInstrumentation.getInstrumentedModules()).toEqual(['mongodb']);
  });
});
