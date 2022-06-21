import { Http, isValidHttpRequestBody } from '../../../hooks/http';

describe('http hook', () => {
  process.env['AWS_REGION'] = 'us-east-x';
  process.env['_X_AMZN_TRACE_ID'] =
    'Root=1-5b1d2450-6ac46730d346cad0e53f89d0;Parent=59fa1aeb03c2ec1f;Sampled=1';

  test('httpRequestEmitBeforeHookWrapper -> not crashed on bad data', () => {
    const requestData = {
      body: '',
    };

    const emitEventName = 'emit';
    const emitArg = {
      _httpMessage: {
        _hasBody: true,
        output: 1,
      },
    };

    const wrapper = Http.httpRequestEmitBeforeHookWrapper(requestData);
    wrapper(emitEventName, emitArg);

    expect(requestData).toEqual({ body: '' });
  });

  test('isValidHttpRequestBody - simple flow', () => {
    expect(isValidHttpRequestBody('BODY')).toEqual(true);
    expect(isValidHttpRequestBody(Buffer.from('BODY'))).toEqual(true);
  });

  test('isValidHttpRequestBody -> empty flow', () => {
    expect(isValidHttpRequestBody()).toEqual(false);
    expect(isValidHttpRequestBody('')).toEqual(false);
    expect(isValidHttpRequestBody(0)).toEqual(false);
    expect(isValidHttpRequestBody([])).toEqual(false);
    expect(isValidHttpRequestBody({})).toEqual(false);
    expect(isValidHttpRequestBody(undefined)).toEqual(false);
    expect(isValidHttpRequestBody(null)).toEqual(false);
  });
});
