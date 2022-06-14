module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/**/*.test.ts','**/**/*.test.js'],
  roots: ['./src/test/unit'],
  coverageDirectory: './coverage/',
  collectCoverage: true,
  collectCoverageFrom: [
    '**/src/**/**/**/**.js',
    '**/src/**/**/**/**.ts',
    '!./src/tools/xmlToJson.ts',
    '!./src/expressAppProgrematically.js',
    '!./src/instrumentros/logsInstrumentation.ts',
  ],
  // setupFilesAfterEnv: ['./testUtils/jest.setup.js'],
  coverageThreshold: {
    global: {
      lines: 100,
    },
  },
};
