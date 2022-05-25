module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/**/*.test.ts','**/**/*.test.js'],
  roots: ['./src'],
  coverageDirectory: './coverage/',
  collectCoverage: true,
  collectCoverageFrom: [
    '**/src/**/**/**/**.js',
    '**/src/**/**/**/**.ts',
  ],
};