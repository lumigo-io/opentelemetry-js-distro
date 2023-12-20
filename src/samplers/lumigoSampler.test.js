import { doesEndpointMatchRegexes, extractEndpoint, parseStringToArray } from './lumigoSampler';
import { SpanKind } from '@opentelemetry/api';

describe('lumigo sampler', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test.each`
    rawArrayString    | expectedArray
    ${'["a"]'}        | ${['a']}
    ${'["a", "b"]'}   | ${['a', 'b']}
    ${'[]'}           | ${[]}
    ${'"a","b"'}      | ${[]}
    ${'Not an array'} | ${[]}
    ${null}           | ${[]}
    ${undefined}      | ${[]}
    ${'["a", 2]'}     | ${[]}
    ${'["a", true]'}  | ${[]}
  `('test parse array string', ({ rawArrayString, expectedArray }) => {
    expect(parseStringToArray(rawArrayString)).toEqual(expectedArray);
  });

  describe('test when there is a match', () => {
    const endpoint = 'https://example.com';
    const regexes = ['.*example.*'];
    const expected = true;
    test('test regex match endpoint', () => {
      expect(doesEndpointMatchRegexes(endpoint, regexes)).toEqual(expected);
    });
  });

  test.each`
    endpoint                 | regexes                                 | shouldMatch
    ${'https://example.com'} | ${['.*example.*']}                      | ${true}
    ${'/orders/123'}         | ${['.*orders.*']}                       | ${true}
    ${'/orders/123'}         | ${['.*will-not-match.*', '.*orders.*']} | ${true}
    ${'/orders/123'}         | ${[]}                                   | ${false}
    ${'/orders/123'}         | ${['no-match-1', 'no-match-2']}         | ${false}
    ${''}                    | ${['.*']}                               | ${false}
    ${null}                  | ${['.*']}                               | ${false}
    ${undefined}             | ${['.*']}                               | ${false}
  `('test regex match endpoint', ({ endpoint, regexes, shouldMatch }) => {
    expect(doesEndpointMatchRegexes(endpoint, regexes)).toEqual(shouldMatch);
  });

  test.each`
    attributes                                                | spanKind           | expectedEndpoint
    ${{ 'url.path': 'urlPath', 'http.target': 'httpTarget' }} | ${SpanKind.SERVER} | ${'urlPath'}
    ${{ a: 'a', 'http.target': 'httpTarget' }}                | ${SpanKind.SERVER} | ${'httpTarget'}
    ${{ 'url.full': 'fullUrl', 'http.url': 'httpUrl' }}       | ${SpanKind.CLIENT} | ${'fullUrl'}
    ${{ a: 'a', 'http.url': 'httpUrl' }}                      | ${SpanKind.CLIENT} | ${'httpUrl'}
    ${{
  'url.path': 'urlPath',
  'http.target': 'httpTarget',
  'url.full': 'fullUrl',
  'http.url': 'httpUrl',
}} | ${SpanKind.INTERNAL} | ${null}
    ${{}}                                                     | ${SpanKind.SERVER} | ${null}
    ${{}}                                                     | ${SpanKind.CLIENT} | ${null}
  `('test extract endpoint', ({ attributes, spanKind, expectedEndpoint }) => {
    expect(extractEndpoint(attributes, spanKind)).toEqual(expectedEndpoint);
  });
});
