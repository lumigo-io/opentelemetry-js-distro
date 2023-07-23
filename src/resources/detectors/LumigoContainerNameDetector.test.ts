import { LumigoContainerNameDetector } from './LumigoContainerNameDetector';
import mock from 'mock-fs';

describe('LumigoContainerNameDetector', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV }; // Make a copy of env so that we can alter it in tests
  });

  afterEach(() => {
    process.env = OLD_ENV; // Restore old environment
    jest.resetAllMocks();
  });

  describe('lumigo container name is detected correctly', () => {
    beforeEach(() => {
      process.env.LUMIGO_CONTAINER_NAME = 'some_container_name';
    });

    it('detects resource attributes correctly', async () => {
      const resource = await new LumigoContainerNameDetector().detect();
      expect(resource.attributes).toEqual({
        'k8s.node.name': 'some_container_name',
      });
    });
  });

  describe('no container name found', () => {
    it('detects resource attributes correctly', async () => {
      const resource = await new LumigoContainerNameDetector().detect();
      expect(resource.attributes).not.toHaveProperty('k8s.node.name');
    });
  });
});
