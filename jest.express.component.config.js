module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/**/express.*.test.ts','**/**/express.*.test.js'],
  roots: ['./src/test/component'],
  setupFilesAfterEnv: ["./jest.setup.js", "jest-chain"],
};
