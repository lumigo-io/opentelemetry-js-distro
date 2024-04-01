import path from 'path';
import { getSpanAttributeMaxLength, safeRequire } from './utils';
import { version } from '../package.json';

describe('getSpanAttributeMaxLength', () => {
  describe('value according to env. vars', () => {
    beforeEach(() => {
      jest.resetModules();
      process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = undefined;
      process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = undefined;
    });

    it('when OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT is set', () => {
      process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = '1';
      const size = getSpanAttributeMaxLength();
      expect(size).toEqual(1);
    });

    it('when OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT is set', () => {
      process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '50';
      const size = getSpanAttributeMaxLength();
      expect(size).toEqual(50);
    });

    it('when OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT and OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT are set', () => {
      process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = '1';
      process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '50';
      const size = getSpanAttributeMaxLength();
      expect(size).toEqual(1);
    });

    it('when no env. vars are set, get default value', () => {
      const size = getSpanAttributeMaxLength();
      expect(size).toEqual(2048);
    });

    it('when OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT is set to NaN will return default value', () => {
      process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = 'a';
      const size = getSpanAttributeMaxLength();
      expect(size).toEqual(2048);
    });
  });
});

describe('safeRequire', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('requires an existing module with the given path', () => {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');

    const result = safeRequire(packageJsonPath);

    expect(result.version).toEqual(version);
  });

  test('does not fail but returns undefined for a non-existing module', () => {
    const result = safeRequire('BlaBlaBlaBla');

    expect(result).toBeUndefined();
  });

  test('does not fail but returns undefined when an errors occurs when loading the module', () => {
    jest.doMock('fs', () => {
      throw Error('RandomError');
    });

    const result = safeRequire('fs');

    expect(result).toBeUndefined();
  });
});
