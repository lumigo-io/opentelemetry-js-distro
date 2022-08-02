import { extractEnvVars } from './utils';

describe('utils tests', () => {
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
