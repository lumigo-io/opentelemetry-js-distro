import { extractEnvVars, getMaxSize, safeRequire } from './utils';

describe('utils tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('safeRequire -> simple flow', () => {
    const http = require('http');

    const result = safeRequire('http');

    expect(http).toEqual(result);
  });

  test('safeRequire -> not exist', () => {
    const result = safeRequire('BlaBlaBlaBla');

    expect(result).toBeFalsy();
  });

  test('safeRequire -> other error', () => {
    jest.doMock('fs', () => {
      throw Error('RandomError');
    });

    const result = safeRequire('fs');

    expect(result).toBeFalsy();
  });

  describe('when evn vars are less then max size', () => {
    it('extractEnvVars should not filter anything', () => {
      process.env = {
        a: '2',
      };
      const env = extractEnvVars();
      expect(env).toEqual(process.env);
    });
  });

  describe('when evn vars are more then max size', () => {
    it('extractEnvVars should filter exceeds data', () => {
      process.env = {
        a: '3'.repeat(5000),
        b: '1',
        c: '2',
        d: '2'.repeat(5000),
      };
      const env = extractEnvVars();
      expect({
        b: '1',
        c: '2',
      }).toEqual(env);
    });
  });
});

describe('get max size value according to env. vars', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = undefined;
    process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = undefined;
  });

  it('get max size when OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT is set', () => {
    process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = '1';
    const size = getMaxSize();
    expect(size).toEqual(1);
  });

  it('get max size when OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT is set', () => {
    process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '50';
    const size = getMaxSize();
    expect(size).toEqual(50);
  });

  it('get max size when OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT and OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT are set', () => {
    process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = '1';
    process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '50';
    const size = getMaxSize();
    expect(size).toEqual(1);
  });

  it('get max size when no env. vars are set, get default value', () => {
    const size = getMaxSize();
    expect(size).toEqual(2048);
  });

  it('get max size when OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT is set to NaN will return default value', () => {
    process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = 'a';
    const size = getMaxSize();
    expect(size).toEqual(2048);
  });
});
