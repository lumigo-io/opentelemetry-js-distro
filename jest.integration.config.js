module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/**/*.test.ts','**/**/*.test.js'],
  roots: ['./src/test/integration'],
  coverageDirectory: './coverage/',
  collectCoverage: true,
  collectCoverageFrom: [
    '**/src/**/**/**/**.js',
    '**/src/**/**/**/**.ts',
  ],
};