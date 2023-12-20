import { extractEndpoint } from './lumigoSampler';

describe('lumigo sampler', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // [
  //   {
  //     description: 'happy flow - full url field exists',
  //     cases: [
  //       {
  //         attributes: {
  //           'http.url': 'https://example.com',
  //         },
  //         expectedUrl: 'https://example.com',
  //       },
  //       {
  //         attributes: {
  //           'http.url': 'https://example.com?page=1',
  //         },
  //         expectedUrl: 'https://example.com?page=1',
  //       },
  //     ],
  //   },
  //   {
  //     description: 'happy flow - schema host and target fields exist',
  //     cases: [
  //       {
  //         attributes: {
  //           'http.scheme': 'https',
  //           'http.host': 'example.com',
  //           'http.target': '/',
  //         },
  //         expectedUrl: 'https://example.com',
  //       },
  //       {
  //         attributes: {
  //           'http.scheme': 'https',
  //           'http.host': 'example.com',
  //           'http.target': '/about',
  //         },
  //         expectedUrl: 'https://example.com/about',
  //       },
  //       {
  //         attributes: {
  //           'http.scheme': 'https',
  //           'http.host': 'example.com',
  //           'http.target': '/about?page=1',
  //         },
  //         expectedUrl: 'https://example.com/about?page=1',
  //       },
  //     ],
  //   },
  //   {
  //     description: 'http endpoint standard port',
  //     cases: [
  //       {
  //         attributes: {
  //           'http.url': 'https://example.com:443',
  //         },
  //         expectedUrl: 'https://example.com',
  //       },
  //       {
  //         attributes: {
  //           'http.url': 'http://example.com:80',
  //         },
  //         expectedUrl: 'http://example.com',
  //       },
  //     ],
  //   },
  //   {
  //     description: 'http endpoint non standard port',
  //     cases: [
  //       {
  //         attributes: {
  //           'http.url': 'https://example.com:80',
  //         },
  //         expectedUrl: 'https://example.com:80',
  //       },
  //       {
  //         attributes: {
  //           'http.url': 'https://example.com:80/about',
  //         },
  //         expectedUrl: 'https://example.com:80/about',
  //       },
  //       {
  //         attributes: {
  //           'http.url': 'http://example.com:443',
  //         },
  //         expectedUrl: 'http://example.com:443',
  //       },
  //       {
  //         attributes: {
  //           'http.url': 'http://example.com:443/about',
  //         },
  //         expectedUrl: 'http://example.com:443/about',
  //       },
  //       {
  //         attributes: {
  //           'http.scheme': 'https',
  //           'http.host': 'example.com:80',
  //           'http.target': '/about',
  //         },
  //         expectedUrl: 'https://example.com:80/about',
  //       },
  //     ],
  //   },
  //   {
  //     description: 'http root url',
  //     cases: [
  //       {
  //         attributes: {
  //           'http.url': 'https://example.com/',
  //         },
  //         expectedUrl: 'https://example.com',
  //       },
  //     ],
  //   },
  //   {
  //     description: 'missing values',
  //     cases: [
  //       {
  //         attributes: null,
  //         expectedUrl: null,
  //       },
  //       {
  //         attributes: undefined,
  //         expectedUrl: null,
  //       },
  //       {
  //         attributes: {},
  //         expectedUrl: null,
  //       },
  //     ],
  //   },
  // ].map(({ description, cases }) => {
  //   return cases.map(({ attributes, expectedUrl }) => {
  //     test(`test extract url from span - ${description}`, () => {
  //       expect(extractEndpoint(attributes)).toEqual(expectedUrl);
  //     });
  //   });
  // });
});
