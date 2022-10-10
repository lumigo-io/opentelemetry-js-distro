describe('dependency reporting', () => {
  const ORIGINAL_PROCESS_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_PROCESS_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_PROCESS_ENV;
    jest.clearAllMocks();
  });

  test('is disabled if LUMIGO_TRACER_TOKEN is not set', () => {
    jest.isolateModules(async () => {
      const utils = require('../utils');
      jest.mock('../utils');

      const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => {
        return Promise.resolve();
      });

      const { init } = jest.requireActual('../wrapper');
      const { reportDependencies } = await init;

      await reportDependencies;

      expect(reportDependencies).resolves.toEqual('No Lumigo token available');
      expect(postUri).not.toHaveBeenCalled();
    });
  });

  test('is disabled if the "LUMIGO_REPORT_DEPENDENCIES" set to something different than "true"', () => {
    jest.isolateModules(async () => {
      process.env['LUMIGO_TRACER_TOKEN'] = 'abcdef';
      process.env['LUMIGO_REPORT_DEPENDENCIES'] = 'false';

      const utils = require('../utils');
      jest.mock('../utils');

      const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => {
        return Promise.resolve();
      });

      const { init } = jest.requireActual('../wrapper');
      const { reportDependencies } = await init;

      await reportDependencies;

      expect(reportDependencies).resolves.toEqual('Dependency reporting is turned off');
      expect(postUri).not.toHaveBeenCalled();
    });
  });

  test('submits dependencies to the backend', () => {
    jest.isolateModules(async () => {
      const lumigoToken = 'abcdef';
      process.env['LUMIGO_TRACER_TOKEN'] = lumigoToken;

      const utils = require('../utils');
      jest.mock('../utils');

      const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => {
        return Promise.resolve();
      });

      const { init } = jest.requireActual('../wrapper');
      const { reportDependencies } = await init;

      await reportDependencies;

      expect(reportDependencies).resolves.toBeUndefined();

      expect(postUri.mock.calls.length).toBe(1);

      const [dependenciesEndpoint, data, headers] = postUri.mock.calls[0];

      expect(dependenciesEndpoint).not.toBeFalsy();
      expect(data.resourceAttributes['lumigo.distro.version']).toBe('unknown');
      expect(data.packages.length).toBeGreaterThan(0);
      expect(headers).toEqual({ Authorization: `LumigoToken ${lumigoToken}` });
    });
  });
});
