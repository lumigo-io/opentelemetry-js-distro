import LumigoPgInstrumentation from './PgInstrumentation';

describe('LumigoPgInstrumentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  let lumigoPgInstrumentation = new LumigoPgInstrumentation();

  test('getInstrumentedModule should return "pg"', () => {
    expect(lumigoPgInstrumentation.getInstrumentedModule()).toEqual('pg');
  });

  // should not be skipped, see https://lumigo.atlassian.net/browse/RD-11195
  test.skip('requireIfAvailable should return required name', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install pg', { stdio: 'inherit' });
    const pg = require('pg');

    expect(lumigoPgInstrumentation.requireIfAvailable()).toEqual(pg);
    child_process.execSync('npm uninstall pg', { stdio: 'inherit' });
  });
});
