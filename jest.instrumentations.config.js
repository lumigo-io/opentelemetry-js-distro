module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/instrumentations/**/*.test.ts'],
  roots: ['./test'],
  setupFilesAfterEnv: ['./jest.instrumentations.setup.js', 'jest-json'],
  reporters: [
    'default',
    'jest-summarizing-reporter'
  ]
};
