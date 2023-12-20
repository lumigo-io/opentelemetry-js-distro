import {doesEndpointMatchRegexes, extractEndpoint, parseStringToArray} from './lumigoSampler';
import {SpanKind} from "@opentelemetry/api";

describe('lumigo sampler', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  [
    {
      rawArrayString: '["a"]',
      expectedArray: ['a'],
    },
    {
      rawArrayString: '["a", "b"]',
      expectedArray: ['a', 'b'],
    },
    {
      rawArrayString: '[]',
      expectedArray: [],
    },
    {
      rawArrayString: '"a","b"',
      expectedArray: [],
    },
    {
      rawArrayString: 'Not an array',
      expectedArray: [],
    },
    {
      rawArrayString: null,
      expectedArray: [],
    },
    {
      rawArrayString: undefined,
      expectedArray: [],
    },
    {
      rawArrayString: '["a", 2]',
      expectedArray: [],
    },
    {
      rawArrayString: '["a", true]',
      expectedArray: [],
    },
  ].map(({ rawArrayString, expectedArray }) => {
    test(`test parse array string - ${rawArrayString}`, () => {
      expect(parseStringToArray(rawArrayString)).toEqual(expectedArray);
    });
  });

  [
    {
      endpoint: 'https://example.com',
      regexes: ['.*example.*'],
      shouldMatch: true,
    },
    {
      endpoint: '/orders/123',
      regexes: ['.*orders.*'],
      shouldMatch: true,
    },
    {
      endpoint: '/orders/123',
      regexes: ['.*will-not-match.*', '.*orders.*'],
      shouldMatch: true,
    },
    {
      endpoint: '/orders/123',
      regexes: [],
      shouldMatch: false,
    },
    {
      endpoint: '/orders/123',
      regexes: ['no-match-1', 'no-match-2'],
      shouldMatch: false,
    },
    {
      endpoint: '',
      regexes: ['.*'],
      shouldMatch: false,
    },
    {
      endpoint: null,
      regexes: ['.*'],
      shouldMatch: false,
    },
    {
      endpoint: undefined,
      regexes: ['.*'],
      shouldMatch: false,
    }
  ].map(({ endpoint, regexes, shouldMatch }) => {
    test(`test regex match - ${endpoint}`, () => {
      expect(doesEndpointMatchRegexes(endpoint, regexes)).toEqual(shouldMatch);
    });
  });

  [
    {
      attributes: {'url.path': 'urlPath', 'http.target': 'httpTarget'},
      spanKind: SpanKind.SERVER,
      expectedEndpoint: 'urlPath',
    },
    {
      attributes: {'a': 'a', 'http.target': 'httpTarget'},
      spanKind: SpanKind.SERVER,
      expectedEndpoint: 'httpTarget',
    },
    {
      attributes: {'url.full': 'fullUrl', 'http.url': 'httpUrl'},
      spanKind: SpanKind.CLIENT,
      expectedEndpoint: 'fullUrl',
    },
    {
      attributes: {'a': 'a', 'http.url': 'httpUrl'},
      spanKind: SpanKind.CLIENT,
      expectedEndpoint: 'httpUrl',
    },
    {
      attributes: {'url.path': 'urlPath', 'http.target': 'httpTarget', 'url.full': 'fullUrl', 'http.url': 'httpUrl'},
      spanKind: SpanKind.INTERNAL,
      expectedEndpoint: null,
    },
    {
      attributes: {},
      spanKind: SpanKind.SERVER,
      expectedEndpoint: null,
    },
    {
      attributes: {},
      spanKind: SpanKind.CLIENT,
      expectedEndpoint: null,
    }
  ].map(({ attributes, spanKind, expectedEndpoint }) => {
    test(`test extract endpoint - ${JSON.stringify(attributes)}`, () => {
      expect(extractEndpoint(attributes, spanKind)).toEqual(expectedEndpoint);
    });
  });
});
