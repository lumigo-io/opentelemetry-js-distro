require("jest-json");
require("jest-chain");

const oldEnv = Object.assign({}, process.env);

beforeEach(() => {
  process.env = { ...oldEnv };
});

afterEach(() => {
  process.env = { ...oldEnv };
});

beforeAll(() => {
  global.console = require('console');
  require( 'console-stamp' )( global.console )
});