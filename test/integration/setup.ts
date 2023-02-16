import {instrumentationsVersionManager} from '../helpers/InstrumentationsVersionManager';
import fs from 'fs';
import rimraf from 'rimraf';
import jestGlobals from '@jest/globals'

interface DescribeParamParam {
    name: string;
    describeParamConfig: DescribeParamConfig;
}

interface DescribeParamConfig {
    dependencyPath: string;
}


interface TestParam {
    itParamConfig: TestParamConfig;
}

interface TestParamConfig {
    integration: string;
    spansFilePath: string;
    supportedVersion: number;
    timeout: number;
}

export const describe = function (
    {name, describeParamConfig = null}: DescribeParamParam,
    describeCode: () => void
) {
    afterEach(async () => {
        rimraf.sync(describeParamConfig.dependencyPath);
    });

    jestGlobals.describe(name, describeCode)
};

/**
 * @param testName
 * @param itParamConfig?: {integration: string, spansFilePath: string, supportedVersion: int, timeout: int}
 * @param timeout: test timeout
 * @param testCode: Callable, function to test
 */
export const test = function (
    testName :string,
    {itParamConfig = null}: TestParam,
    testCode : (path: string) => void
) {
    const integration = itParamConfig.integration;
    const versionsToTest = require(`./${integration}/app/${integration}_versions.json`);
    for (let version of versionsToTest) {
        const integrationWithVersion = `${integration}@${version}`;

        global.console = require('console');
        require( 'console-stamp' )(  global.console, {
                format: `(${integrationWithVersion}) :date() :label(7)`
        } );

        const testMessage = `test happy flow on ${integrationWithVersion} / node@${process.version}`;
        const testSupportedVersion = itParamConfig.supportedVersion;
        if (testSupportedVersion && parseInt(version) !== testSupportedVersion) {
            continue;
        }
        jestGlobals.test(testMessage, async function () {
            try {
                console.info(`Starting the test: ${testMessage}\n`);
                fs.renameSync(
                    `${__dirname}/${integration}/app/node_modules/${integrationWithVersion}`,
                    `${__dirname}/${integration}/app/node_modules/${integration}`
                );
                const FILE_EXPORTER_FILE_NAME = `${(itParamConfig.spansFilePath)}/spans-test-${integrationWithVersion}.json`;

                await testCode(FILE_EXPORTER_FILE_NAME);
                instrumentationsVersionManager.addPackageSupportedVersion(integration, version);
                console.info(`Test ${testMessage} was finished successfully`)
            } catch (e) {
                console.error(`${integrationWithVersion} / node@${process.version} failed!`, e);
                instrumentationsVersionManager.addPackageUnsupportedVersion(integration, version);
                console.error(`Test ${testMessage} failed!`)
                throw e;
            }
        }, itParamConfig.timeout);
    }
};