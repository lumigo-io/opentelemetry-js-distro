import { getSpanAttributeMaxLength, safeParse } from './utils';

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

describe('safeParse', () => {
  it('should return the parsed object', () => {
    const obj = { a: 1, b: 2 };
    expect(safeParse(JSON.stringify(obj))).toEqual(obj);
  });

  it('should return the same string', () => {
    const str = 'test';
    expect(safeParse(str)).toEqual(str);
  });
});
