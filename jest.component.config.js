module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/component/*.test.ts'],
  roots: ['./test'],
  setupFilesAfterEnv: ['./jest.integration.setup.js'],
};
