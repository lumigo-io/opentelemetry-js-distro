import { extractEnvVars } from './utils';

describe('utils tests', () => {
  describe('when evn vars are less then max size', () => {
    it('extractEnvVars should not filter anything', () => {
      process.env = {
        a: '2',
      };
      const env = extractEnvVars();
      expect(process.env).toEqual(env);
    });
  });

  describe('when evn vars are more then max size', () => {
    it('extractEnvVars should filter exes data', () => {
      process.env = {
        a: '1',
        b: '2',
        c: '3'.repeat(5000),
      };
      const env = extractEnvVars();
      expect({
        a: '1',
        b: '2',
      }).toEqual(env);
    });
  });
});
