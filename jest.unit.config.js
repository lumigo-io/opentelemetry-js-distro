module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/**/*.test.ts','**/**/*.test.js'],
  roots: ['.'],
  coverageDirectory: './coverage/',
  collectCoverage: true,
  collectCoverageFrom: [
    '**/src/**/**/**/**.js',
    '**/src/**/**/**/**.ts',
    '!./src/tools/xmlToJson.ts',
    '!./src/testUtils/**/**.*',
    '!./src/expressAppProgrematically.js',
    '!./src/instrumentros/logsInstrumentation.ts',
  ],
  setupFilesAfterEnv: ['./jest.setup.js'],
  coverageThreshold: {
    global: {
      lines: 50,
    },
  },
};
