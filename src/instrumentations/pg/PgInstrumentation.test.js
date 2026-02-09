import LumigoPgInstrumentation from './PgInstrumentation';

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
    // We've pre-installed pg in package.json
    process.env.LUMIGO_DISABLE_PG_INSTRUMENTATION = 'true';
    expect(lumigoPgInstrumentation.isApplicable()).toEqual(false);
  });

  test('getInstrumentedModule should return "pg"', () => {
    expect(lumigoPgInstrumentation.getInstrumentedModule()).toEqual('pg');
  });

  // should not be skipped, see https://lumigo.atlassian.net/browse/RD-11195
  test.skip('requireIfAvailable should return required name', () => {
    // We've pre-installed pg in package.json
    // This test is skipped for now
  });
});
