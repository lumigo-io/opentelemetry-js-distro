module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/**/*.test.ts', '**/**/*.test.js'],
  roots: ['./test/component'],
  setupFilesAfterEnv: ['./jest.component.setup.js', 'jest-chain'],
};
