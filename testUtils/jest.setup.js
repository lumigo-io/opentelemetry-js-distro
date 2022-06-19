const oldEnv = Object.assign({}, process.env);

beforeEach(() => {
 console.log("IN JEST SETUP beforeEach")
 process.env = { ...oldEnv };
});

afterEach(() => {
 console.log("IN JEST SETUP afterEach")
 process.env = { ...oldEnv };
 });
