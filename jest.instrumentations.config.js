const allInstrumentations = '**';
const instrumentationToTest = process.env.INSTRUMENTATION_UNDER_TEST || allInstrumentations;

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  testMatch: [`**/instrumentations/${instrumentationToTest}/*.test.ts`],
  roots: ['./test'],
  setupFilesAfterEnv: ['./jest.instrumentations.setup.js', 'jest-json', 'jest-expect-message', 'jest-extended/all'],
  reporters: ['default', 'jest-summarizing-reporter'],
};

module.exports = config;
