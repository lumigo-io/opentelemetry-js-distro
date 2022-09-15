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
      instrumentationVersion: '0.29.0',
      _config: {
        enhancedDatabaseReporting: true,
      },
      _diag: {
        _namespace: '@opentelemetry/instrumentation-mongodb',
      },
      _tracer: {
        _provider: {},
        name: '@opentelemetry/instrumentation-mongodb',
        version: '0.29.0',
      },
      _meter: {},
      _hooks: [
        {
          cache: {},
          _unhooked: false,
        },
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
          patch: undefined,
          unpatch: undefined,
          files: [
            {
              supportedVersions: expect.any(Array),
              name: 'mongodb/lib/core/wireprotocol/index.js',
              patch: expect.any(Function),
              unpatch: expect.any(Function),
            },
          ],
        },
        {
          name: 'mongodb',
          supportedVersions: expect.any(Array),
          patch: undefined,
          unpatch: undefined,
          files: [
            {
              supportedVersions: expect.any(Array),
              name: 'mongodb/lib/cmap/connection.js',
              patch: expect.any(Function),
              unpatch: expect.any(Function),
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
