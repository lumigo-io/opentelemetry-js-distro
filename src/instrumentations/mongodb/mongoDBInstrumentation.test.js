import LumigoMongoDBInstrumentation from './MongoDBInstrumentation';

describe('LumigoMongoDBInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoMongoDBInstrumentation = new LumigoMongoDBInstrumentation();

  test('getInstrumentationId should return "mongodb"', () => {
    expect(lumigoMongoDBInstrumentation.getInstrumentationId()).toEqual('mongodb');
  });

  test('getInstrumentation should return MongoDBInstrumentation object', () => {
    expect(lumigoMongoDBInstrumentation.getInstrumentation()).toMatchObject({
      instrumentationName: '@opentelemetry/instrumentation-mongodb',
      instrumentationVersion: '0.28.0',
      _config: {
        enhancedDatabaseReporting: true,
      },
      _diag: {
        _namespace: '@opentelemetry/instrumentation-mongodb',
      },
      _tracer: {
        _provider: {},
        name: '@opentelemetry/instrumentation-mongodb',
        version: '0.28.0',
      },
      _meter: {},
      _hooks: [
        {
          cache: {},
          _unhooked: false,
        },
      ],
      _enabled: true,
      _modules: [
        {
          name: 'mongodb',
          supportedVersions: expect.any(Array),
          files: [
            {
              supportedVersions: expect.any(Array),
              name: 'mongodb/lib/core/wireprotocol/index.js',
            },
          ],
        },
      ],
    });
  });

  test.skip('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install mongodb', { stdio: 'inherit' });
    const mongodb = require('mongodb');

    expect(lumigoMongoDBInstrumentation.requireIfAvailable()).toEqual(mongodb);
    child_process.execSync('npm uninstall mongodb', { stdio: 'inherit' });
  });
});
