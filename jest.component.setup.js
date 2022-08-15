const oldEnv = Object.assign({}, process.env);
jest.setTimeout(20000);
beforeEach(() => {
  process.env = { ...oldEnv };
});

afterEach(() => {
  process.env = { ...oldEnv };
});
