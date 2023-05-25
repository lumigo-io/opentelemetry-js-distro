import { ScrubContext } from '@lumigo/node-core';
import { scrubHttpPayload } from './payloads';

describe('scrubHttpPayload', () => {
  describe('with non-JSON payload', () => {
    describe.each([
      ['null', null],
      ['undefined', undefined],
      ['NaN', NaN],
    ])('leaves unmodified', (valueToScrubDesc, valueToScrub) => {
      test(`stringifies ${valueToScrubDesc}`, async () => {
        expect(scrubHttpPayload(valueToScrub, 'text/plain', ScrubContext.DEFAULT)).toEqual(
          valueToScrubDesc
        );
      });
    });

    describe.each([
      ['positive numbers', 42, '42'],
      ['negative numbers', -42, '-42'],
      ['true', true, 'true'],
      ['false', false, 'false'],
      ['non-empty strings', 'ciao', '"ciao"'],
      ['non-empty objects', { a: 42 }, '{"a":42}'],
      ['non-empty arrays', ['a', 42], '["a",42]'],
      ['symbol', Symbol.for('MuchHappy'), 'Symbol(MuchHappy)'],
    ])('stringifies', (valueToScrubDesc, valueToScrub, expectedValue) => {
      test(valueToScrubDesc, async () => {
        expect(scrubHttpPayload(valueToScrub, 'text/plain', ScrubContext.DEFAULT)).toEqual(
          expectedValue
        );
      });
    });

    describe.each([
      ['empty arrays', []],
      ['empty objects', {}],
      ['empty string', ''],
    ])('maps to undefined', (valueToScrubDesc, valueToScrub) => {
      test(valueToScrubDesc, async () => {
        expect(scrubHttpPayload(valueToScrub, 'text/plain', ScrubContext.DEFAULT)).toEqual(
          undefined
        );
      });
    });
  });

  describe('with JSON payload', () => {
    describe.each([
      ['positive numbers', 42, '42'],
      ['negative numbers', -42, '-42'],
      ['true', true, 'true'],
      ['false', false, 'false'],
      ['objects', { a: 42 }, '{"a":42}'],
      ['arrays', ['a', 42], '["a",42]'],
    ])('stringifies', (valueToScrubDesc, valueToScrub, expectedValue) => {
      test(valueToScrubDesc, async () => {
        expect(
          scrubHttpPayload(valueToScrub, 'application/json; utf-8', ScrubContext.DEFAULT)
        ).toEqual(expectedValue);
      });
    });

    describe.each([
      ['NaN', NaN],
      ['null', null],
    ])('maps', (valueToScrubDesc, valueToScrub) => {
      test(`maps ${valueToScrubDesc} to "null"`, () => {
        expect(
          scrubHttpPayload(valueToScrub, 'application/json; utf-8', ScrubContext.DEFAULT)
        ).toEqual('null');
      });
    });

    describe.each([
      ['undefined', undefined],
      ['symbols', Symbol.for('MuchHappy')],
    ])('maps to the empty string', (valueToScrubDesc, valueToScrub) => {
      test(valueToScrubDesc, async () => {
        expect(
          scrubHttpPayload(valueToScrub, 'application/json; utf-8', ScrubContext.DEFAULT)
        ).toEqual('');
      });
    });
  });
});
