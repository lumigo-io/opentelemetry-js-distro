module.exports = {
  preset: "ts-jest/presets/js-with-ts",
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts','**/*.test.js'],
  roots: ['./test/component'],
};
