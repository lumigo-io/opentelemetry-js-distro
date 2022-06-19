module.exports = {
  preset: "ts-jest/presets/js-with-ts",
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts','**/*.test.js'],
  roots: ['./src'],
  coverageDirectory: './coverage/',
  collectCoverage: true,
  collectCoverageFrom: ['**/*.test.ts','**/*.test.js'],
};
