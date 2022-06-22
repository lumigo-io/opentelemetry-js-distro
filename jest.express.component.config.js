module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/**/express.*.test.ts','**/**/express.*.test.js'],
  roots: ['./test/component'],
  setupFilesAfterEnv: ["./jest.setup.js", "jest-chain"],
};
