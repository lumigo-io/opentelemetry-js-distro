import { version as expectedVersion } from '../package.json';

describe('version extraction', () => {
  test('extracts the version of the distro properly', async () => {
    // Run in an isolated sandbox, to avoid the next test from failing due to init() being called twice in the same process
    await jest.isolateModulesAsync(async () => {
      const { logger } = require('./logging');
      const loggerSpy = jest.spyOn(logger, 'info');

      const { init } = require('./bootstrap');
      await init();

      expect(loggerSpy).toHaveBeenCalledWith(
        `Lumigo OpenTelemetry Distro v${expectedVersion} started.`
      );
    });
  });

  test("uses 'unknown' as version when the version cannot be extracted", async () => {
    await jest.isolateModulesAsync(async () => {
      const { logger } = require('./logging');
      const loggerSpy = jest.spyOn(logger, 'info');

      // Mock a webpack setup where package.json is not available
      global.__non_webpack_require__ = (moduleName) => {
        if (moduleName.includes('package.json')) {
          throw new Error('Cannot find module');
        } else {
          return require(moduleName);
        }
      };
      global.__non_webpack_require__.resolve = require.resolve;

      const { init } = require('./bootstrap');
      await init();

      expect(loggerSpy).toHaveBeenCalledWith(
        `Lumigo OpenTelemetry Distro with unknown version started.`
      );
    });
  });
});
