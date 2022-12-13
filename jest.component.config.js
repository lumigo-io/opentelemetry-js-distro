module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/component/**/*.test.js'],
  roots: ['./test'],
  setupFilesAfterEnv: ['./jest.component.setup.js', "jest-json"],
};
