module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/integration/**/*.test.js'],
  // testMatch: ['**/test/integration/express/express.test.js'],
  roots: ['./test'],
  setupFilesAfterEnv: ['./jest.integration.setup.js', "jest-json"],
  // setupTestFrameworkScriptFile: "jest-json",
};
