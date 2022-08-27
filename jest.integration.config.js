module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/integration/*.test.ts'],
  roots: ['./test'],
  setupFilesAfterEnv: ['./jest.integration.setup.js'],
};
