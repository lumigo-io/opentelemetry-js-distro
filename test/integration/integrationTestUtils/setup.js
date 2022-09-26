const {info, error} = require("console")
const {instrumentationsVersionManager} = require("../../helpers/InstrumentationsVersionManager");
const fs = require("fs");
const rimraf = require("rimraf");
const jestGlobals = require('@jest/globals')

const describe = function (
    {name, itParamConfig = null,},
    describeCode
) {
    afterEach(async () => {
        rimraf.sync(itParamConfig.dependencyPath);
    });

    jestGlobals.describe(name, describeCode)
};

/**
 * @param testName
 * @param itParamConfig?: {integration: string, spansFilePath: string, supportedVersion: int, timeout: int}
 * @param timeout: test timeout
 * @param testCode: Callable, function to test
 */
const test = function (
    testName,
    {itParamConfig = null},
    testCode
) {
    info(`Starting integration tests: `, testName)
    const integration = itParamConfig.integration;
    const versionsToTest = require(`../${integration}/app/${integration}_versions.json`);
    for (let version of versionsToTest) {
        const testMessage = `test happy flow on ${integration}@${version} / node@${process.version}`;
        const testSupportedVersion = itParamConfig.supportedVersion;
        if (testSupportedVersion && parseInt(version) !== testSupportedVersion) {
            continue;
        }
        it(testMessage, async function () {
            try {
                info(`\nStarting the test: ${testMessage}\n`);
                fs.renameSync(
                    `${__dirname}/../${integration}/app/node_modules/${integration}@${version}`,
                    `${__dirname}/../${integration}/app/node_modules/${integration}`
                );
                const FILE_EXPORTER_FILE_NAME = `${(itParamConfig.spansFilePath)}/spans-test-${integration}${version}.json`;

                await testCode(FILE_EXPORTER_FILE_NAME);
                instrumentationsVersionManager.addPackageSupportedVersion(integration, version);
            } catch (e) {
                error(`${integration}@${version} / node@${process.version} failed!`, e);
                instrumentationsVersionManager.addPackageUnsupportedVersion(integration, version);
                throw e;
            }
        }, itParamConfig.timeout);
    }
};

module.exports = {test, describe};