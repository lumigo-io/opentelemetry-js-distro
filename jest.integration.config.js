module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/integration/**/*.test.js'],
  roots: ['./test'],
  setupFilesAfterEnv: ['./jest.integration.setup.js', "jest-json"],
  reporters: [
    "default",
    "jest-github-actions-reporter"
  ],
  testLocationInResults: true
};
