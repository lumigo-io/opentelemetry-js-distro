import { LumigoTagDetector } from './LumigoTagDetector';
import mock from 'mock-fs';

describe('LumigoTagDetector', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV }; // Make a copy of env so that we can alter it in tests
  });

  afterEach(() => {
    process.env = OLD_ENV; // Restore old environment
    jest.resetAllMocks();
  });

  describe('lumigo tag is detected correctly', () => {
    beforeEach(() => {
      process.env.LUMIGO_TAG = 'some_app_tag';
    });

    it('detects resource attributes correctly', async () => {
      const resource = await new LumigoTagDetector().detect();
      expect(resource.attributes).toEqual({
        'lumigo.tag': 'some_app_tag',
      });
    });
  });

  describe('lumigo tag with semicolon is ignored', () => {
    beforeEach(() => {
      process.env.LUMIGO_TAG = 'some_;app_tag';
    });

    it('detects resource attributes correctly', async () => {
      const resource = await new LumigoTagDetector().detect();
      expect(resource.attributes).not.toHaveProperty('lumigo.tag');
    });
  });

  describe('no lumigo tag found', () => {
    it('detects resource attributes correctly', async () => {
      const resource = await new LumigoTagDetector().detect();
      expect(resource.attributes).not.toHaveProperty('lumigo.tag');
    });
  });
});
