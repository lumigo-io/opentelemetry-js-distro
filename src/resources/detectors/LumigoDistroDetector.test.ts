import { LumigoDistroDetector } from './LumigoDistroDetector';

describe('LumigoDistroDetector', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV }; // Make a copy of env so that we can alter it in tests
  });

  afterEach(() => {
    process.env = OLD_ENV; // Restore old environment
    jest.resetAllMocks();
  });

  describe('with Task metadata endpoint version 4', () => {
    beforeEach(() => {
      process.env.ECS_CONTAINER_METADATA_URI_V4 = 'test_url';
    });

    it('detects resource attributes correctly', async () => {
      const resource = await new LumigoDistroDetector(`${__dirname}/../`).detect();

      expect(resource.attributes).toEqual({
        'lumigo.distro.version': 'unknown',
      });
    });
  });
});
