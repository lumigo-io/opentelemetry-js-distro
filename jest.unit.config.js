module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/**/*.test.ts','**/**/*.test.js'],
  roots: ['./src/test/unit'],
  coverageDirectory: './coverage/',
  collectCoverage: true,
  collectCoverageFrom: [
    '**/src/**/**/**/**.js',
    '**/src/**/**/**/**.ts',
  ],
};
