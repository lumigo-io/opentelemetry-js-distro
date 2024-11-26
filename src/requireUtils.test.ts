import path from 'path';
import { safeRequire } from './requireUtils';
import { version } from '../package.json';

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
