module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/integration/**/*.test.js'],
  roots: ['./test'],
<<<<<<< HEAD
  setupFilesAfterEnv: ['./jest.integration.setup.js', "jest-json"],
  reporters: [
    "default",
    "jest-summarizing-reporter"
  ]
=======
  setupFilesAfterEnv: ['./jest.integration.setup.js', 'jest-json'],
>>>>>>> bee6ce5 (Implement dependency reporting)
};
