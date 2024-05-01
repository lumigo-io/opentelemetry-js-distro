import LumigoPgInstrumentation from './PgInstrumentation';
import child_process from 'child_process';

describe('LumigoPgInstrumentation', () => {
  const oldEnv = Object.assign({}, process.env);
  beforeEach(() => {
    process.env = { ...oldEnv };
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = { ...oldEnv };
  });

  let lumigoPgInstrumentation = new LumigoPgInstrumentation();

  test('disable pg instrumentation', () => {
    const child_process = require('child_process');
    child_process.execSync('npm install pg', { stdio: 'inherit' });

    process.env.LUMIGO_DISABLE_PG_INSTRUMENTATION = 'true';
    expect(lumigoPgInstrumentation.isApplicable()).toEqual(false);
  });

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
