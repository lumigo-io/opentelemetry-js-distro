import jestGlobals from '@jest/globals';
import { instrumentationsVersionManager } from '../helpers/InstrumentationsVersionManager';

/**
 * @param testName: string
 * @param packageName: string
 * @param version: string
 * @param timeout: number
 * @param testCode: Callable, function to test
 */
export const itTest = function (
  {
    testName,
    packageName,
    version,
    timeout,
  }: {
    testName: string,
    packageName: string,
    version: string,
    timeout?: number,
  },
  testCode: () => Promise<void>
) {
  global.console = require('console');
  jestGlobals.test(
    testName,
    async function () {
      try {
        console.info(`Starting the test: ${testName}\n`);

        await testCode();
        instrumentationsVersionManager.addPackageSupportedVersion(packageName, version);
        console.info(`Test ${testName} was finished successfully`);
        console.info(
          `Current state of instrumentationsVersionManager: ${JSON.stringify(
            instrumentationsVersionManager.getInstrumentationsVersions()
          )}`
        );
      } catch (e) {
        console.error(`Test ${testName} failed!`, e);
        instrumentationsVersionManager.addPackageUnsupportedVersion(packageName, version);
        console.info(
          `Current state of instrumentationsVersionManager: ${JSON.stringify(
            instrumentationsVersionManager.getInstrumentationsVersions()
          )}`
        );
        throw e;
      }
    },
    timeout
  );
};
