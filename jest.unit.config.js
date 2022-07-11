module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/**/*.test.ts','**/**/*.test.js'],
  roots: ['./src'],
  coverageDirectory: './coverage/',
  collectCoverage: true,
  collectCoverageFrom: [
    '**/src/**/**/**/**.js',
    '**/src/**/**/**/**.ts',
    '!./src/tools/xmlToJson.ts',
    '!./src/testUtils/**/**.*',
    '!./src/instrumentors/logsInstrumentation.ts',
  ],
  setupFilesAfterEnv: ['./jest.setup.js'],
  coverageThreshold: {
    global: {
      lines: 50,
    },
  },
};
