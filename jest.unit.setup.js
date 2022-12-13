const oldEnv = Object.assign({}, process.env);

beforeEach(() => {
 process.env = { ...oldEnv };
});

afterEach(() => {
 process.env = { ...oldEnv };
});
