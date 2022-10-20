import {instrumentationsVersionManager} from "../helpers/InstrumentationsVersionManager";
import fs  from "fs";
import rimraf from "rimraf";
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
    const versionsToTest = require(`../${integration}/app/${integration}_versions.json`);
    for (let version of versionsToTest) {
        const testMessage = `test happy flow on ${integration}@${version} / node@${process.version}`;
        const testSupportedVersion = itParamConfig.supportedVersion;
        if (testSupportedVersion && parseInt(version) !== testSupportedVersion) {
            continue;
        }
        jestGlobals.test(testMessage, async function () {
            try {
                console.info(`Starting the test: ${testMessage}\n`);
                fs.renameSync(
                    `${__dirname}/../${integration}/app/node_modules/${integration}@${version}`,
                    `${__dirname}/../${integration}/app/node_modules/${integration}`
                );
                const FILE_EXPORTER_FILE_NAME = `${(itParamConfig.spansFilePath)}/spans-test-${integration}${version}.json`;

                await testCode(FILE_EXPORTER_FILE_NAME);
                instrumentationsVersionManager.addPackageSupportedVersion(integration, version);
                console.info("Test was finished successfully")
            } catch (e) {
                console.error(`${integration}@${version} / node@${process.version} failed!`, e);
                instrumentationsVersionManager.addPackageUnsupportedVersion(integration, version);
                throw e;
            }
        }, itParamConfig.timeout);
    }
};