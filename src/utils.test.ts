import { extractEnvVars, logger, safeRequire } from './utils';
import http from 'http';

describe('utils tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('safeRequire -> simple flow', () => {
    const http = require('http');

    const result = safeRequire('http');

    expect(http).toEqual(result);
  });

  test('safeRequire -> simple flow', () => {
    delete process.env.NODE_PATH;
    jest.spyOn(logger, 'warn');
    const result = safeRequire('BlaBlaBlaBla');

    expect(result).toEqual(undefined);
    expect(logger.warn).toBeCalledTimes(0);
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
