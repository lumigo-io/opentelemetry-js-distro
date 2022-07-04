import { AwsEcsDetector } from './AwsEcsDetector';

import * as fs from 'fs';
import * as utils from '../../utils';

describe('AwsEcsDetector', () => {
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
      jest.spyOn(utils, 'getUri').mockImplementation((url: string) => {
        let responseRaw: Buffer;
        switch (url) {
          case 'test_url':
            responseRaw = fs.readFileSync(
              __dirname + '/test-resources/metadatav4-response-container.json'
            );
            break;
          case 'test_url/task':
            responseRaw = fs.readFileSync(
              __dirname + '/test-resources/metadatav4-response-task.json'
            );
            break;
          default:
            throw new Error(`Unexpected url '${url}`);
        }

        return Promise.resolve(JSON.parse(responseRaw.toString()));
      });

      const resource = await new AwsEcsDetector().detect();

      expect(resource.attributes).toEqual({
        'aws.ecs.container.arn':
          'arn:aws:ecs:us-west-2:111122223333:container/0206b271-b33f-47ab-86c6-a0ba208a70a9',
        'aws.ecs.cluster.arn': 'arn:aws:ecs:us-west-2:111122223333:cluster/default',
        'aws.ecs.launchtype': 'EC2',
        'aws.ecs.task.arn':
          'arn:aws:ecs:us-west-2:111122223333:task/default/158d1c8083dd49d6b527399fd6414f5c',
        'aws.ecs.task.family': 'curltest',
        'aws.ecs.task.revision': '26',
      });
    });
  });
});
