module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/**/instrumentations.compatibility.test.ts'],
  roots: ['./test'],
  setupFilesAfterEnv: ['./jest.component.setup.js'],
};
