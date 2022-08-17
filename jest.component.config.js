module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/**/*.test.ts', '**/**/*.test.js'],
  roots: ['./test'],
  setupFilesAfterEnv: ['./jest.component.setup.js'],
};
