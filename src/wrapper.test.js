import * as fs from 'fs';
import * as utils from './utils';

const { version } = require('../package.json');

const { Resource } = require('@opentelemetry/resources');
const {
  SemanticResourceAttributes,
  CloudProviderValues,
  CloudPlatformValues,
} = require('@opentelemetry/semantic-conventions');

const mockedResource = new Resource({
  [SemanticResourceAttributes.CLOUD_PROVIDER]: CloudProviderValues.AWS,
  [SemanticResourceAttributes.CLOUD_PLATFORM]: CloudPlatformValues.AWS_EKS,
  [SemanticResourceAttributes.K8S_CLUSTER_NAME]: 'cluster-name',
  [SemanticResourceAttributes.CONTAINER_ID]: 'container-id',
});

import { FileSpanExporter } from './exporters';
jest.mock('./exporters');

import { ExpressInstrumentation } from 'opentelemetry-instrumentation-express';
jest.mock('opentelemetry-instrumentation-express');

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { join } from 'path';
jest.mock('@opentelemetry/exporter-trace-otlp-http');

const LUMIGO_ENDPOINT = 'http://ec2-34-215-6-94.us-west-2.compute.amazonaws.com:55681/v1/trace';
const LUMIGO_TRACER_TOKEN = 't_10faa5e13e7844aaa1234';

const ECS_CONTAINER_METADATA_URI_V4 = 'test_url/v4';
const ECS_CONTAINER_METADATA_URI = 'test_url/v3';

describe('Distro initialization', () => {
  const ORIGINAL_PROCESS_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_PROCESS_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_PROCESS_ENV;
    OTLPTraceExporter.mockClear();
  });

  describe("with the 'LUMIGO_SWITCH_OFF' environment variable set to 'true'", () => {
    it('should not invoke trace initialization', async () => {
      process.env.LUMIGO_SWITCH_OFF = 'true';

      jest.isolateModules(async () => {
        const wrapper = jest.requireActual('./wrapper');

        await wrapper.init.then((sdkInitialized) => {
          expect(OTLPTraceExporter).not.toHaveBeenCalled();
          expect(sdkInitialized).toBeUndefined();
        });
      });
    });
  });

  describe('with an initialization failure', () => {
    beforeEach(() => {
      process.env.LUMIGO_ENDPOINT = LUMIGO_ENDPOINT;
      process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
    });

    test('should reject the init promise', () => {
      jest.isolateModules(async () => {
        const error = new Error('Oh, the humanity!');
        OTLPTraceExporter.mockImplementation(() => {
          throw error;
        });
        const wrapper = jest.requireActual('./wrapper');
        expect(wrapper.init).rejects.toThrowError(error);
      });
    });
  });

  test('should initialize instrumentation', () => {
    jest.isolateModules(async () => {
      const wrapper = jest.requireActual('./wrapper');
      const utils = jest.requireActual('./Utils');
      jest.spyOn(utils.logger, 'info');
      jest.mock(
        '../package.json',
        () => ({
          name: '__name__',
          version: '1.0.1',
        }),
        { virtual: true }
      );
      await wrapper.init.then(() => {
        expect(ExpressInstrumentation).toHaveBeenCalled();
        expect(utils.logger.info).toHaveBeenCalledWith(`Lumigo tracer v1.0.1 started.`);
      });
    });
  });

  test('Secret keys should be redacted from env vars by LUMIGO_SECRET_MASKING_REGEX', async () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      process.env.LUMIGO_SECRET_MASKING_REGEX = '["VAR_TO_MASK"]';
      process.env.VAR_TO_MASK = 'some value';

      const wrapper = jest.requireActual('./wrapper');
      await wrapper.init
        .then((initStatus) => initStatus.tracerProvider.resource)
        .then((resource) => {
          const vars = JSON.parse(resource.attributes['process.environ']);
          expect(vars.VAR_TO_MASK).toEqual('****');
        });
    });
  });

  test('Secret keys should be redacted from env vars', async () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      process.env.AUTHORIZATION = 'some value';

      const wrapper = jest.requireActual('./wrapper');
      await wrapper.init
        .then((initStatus) => initStatus.tracerProvider.resource)
        .then((resource) => {
          const vars = JSON.parse(resource.attributes['process.environ']);
          expect(vars.AUTHORIZATION).toEqual('****');
        });
    });
  });

  describe('with the LUMIGO_TRACER_TOKEN environment variable set', () => {
    beforeEach(() => {
      process.env.LUMIGO_ENDPOINT = LUMIGO_ENDPOINT;
      process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
    });

    test('should initialize the OTLPTraceExporter', () => {
      jest.isolateModules(async () => {
        const wrapper = jest.requireActual('./wrapper');
        await wrapper.init.then(() => {
          expect(OTLPTraceExporter).toHaveBeenCalledWith({
            headers: {
              Authorization: 'LumigoToken t_10faa5e13e7844aaa1234',
            },
            url: LUMIGO_ENDPOINT,
          });
        });
      });
    });

    describe('with the LUMIGO_DEBUG_SPANDUMP variable set', () => {
      beforeEach(() => {
        process.env.LUMIGO_DEBUG_SPANDUMP = '/dev/stdout';
      });

      test('should initialize the FileSpanExporter', () => {
        jest.isolateModules(async () => {
          const wrapper = jest.requireActual('./wrapper');
          await wrapper.init.then(() => {
            expect(FileSpanExporter).toHaveBeenCalledWith('/dev/stdout');
          });
        });
      });
    });
  });

  describe('without the LUMIGO_TRACER_TOKEN environment variable set', () => {
    test('should not initialize the OTLPTraceExporter', () => {
      jest.isolateModules(async () => {
        const wrapper = jest.requireActual('./wrapper');
        await wrapper.init.then(() => {
          expect(OTLPTraceExporter).not.toHaveBeenCalled();
        });
      });
    });

    describe('with the LUMIGO_DEBUG_SPANDUMP variable set', () => {
      beforeEach(() => {
        process.env.LUMIGO_DEBUG_SPANDUMP = '/dev/stdout';
      });

      test('should initialize the FileSpanExporter', () => {
        jest.isolateModules(async () => {
          const wrapper = jest.requireActual('./wrapper');
          await wrapper.init.then(() => {
            expect(FileSpanExporter).toHaveBeenCalledWith('/dev/stdout');
          });
        });
      });
    });
  });

  describe('outside of a computing platform for which we have detectors', () => {
    test('NodeTracerProvider should be given a resource with all the right attributes', async () => {
      jest.isolateModules(async () => {
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
        const wrapper = jest.requireActual('./wrapper');
        await wrapper.init
          .then((initStatus) => initStatus.tracerProvider.resource)
          .then((resource) => {
            expect(resource.attributes['framework']).toBe('express');
            expect(resource.attributes['service.name']).toBe('service-1');

            checkBasicResourceAttributes(resource);
          });
      });
    });
  });

  describe('On Amazon ECS', () => {
    beforeEach(() => {
      process.env.ECS_CONTAINER_METADATA_URI = ECS_CONTAINER_METADATA_URI;
    });

    describe('without the Task Metadata V4 endpoint', () => {
      test('NodeTracerProvider should be given a resource with all the right attributes', async () => {
        jest.isolateModules(async () => {
          process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
          process.env.OTEL_SERVICE_NAME = 'service-1';

          const wrapper = jest.requireActual('./wrapper');
          await wrapper.init
            .then((initStatus) => initStatus.tracerProvider.resource)
            .then((resource) => {
              checkBasicResourceAttributes(resource);

              const resourceAttributeKeys = Object.keys(resource.attributes);

              // Default ECS from upstream detector
              expect(resource.attributes['cloud.provider']).toBe('aws');
              expect(resource.attributes['cloud.platform']).toBe('aws_ecs');

              // These properties may left be blank in the test env
              expect(resourceAttributeKeys).toContain('container.id');
              expect(resourceAttributeKeys).toContain('container.name');
            });
        });
      });
    });

    describe('with the Task Metadata V4 endpoint', () => {
      beforeEach(() => {
        process.env.ECS_CONTAINER_METADATA_URI_V4 = ECS_CONTAINER_METADATA_URI_V4;

        jest.spyOn(utils, 'getUri').mockImplementation((url) => {
          let responseRaw;
          switch (url) {
            case ECS_CONTAINER_METADATA_URI_V4:
              responseRaw = fs.readFileSync(
                __dirname + '/resources/detectors/test-resources/metadatav4-response-container.json'
              );
              break;
            case `${ECS_CONTAINER_METADATA_URI_V4}/task`:
              responseRaw = fs.readFileSync(
                __dirname + '/resources/detectors/test-resources/metadatav4-response-task.json'
              );
              break;
            default:
              throw new Error(`Unexpected url '${url}`);
          }

          return Promise.resolve(JSON.parse(responseRaw.toString()));
        });
      });

      test('NodeTracerProvider should be given a resource with all the right attributes', async () => {
        jest.isolateModules(async () => {
          process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
          process.env.OTEL_SERVICE_NAME = 'service-1';

          const wrapper = jest.requireActual('./wrapper');
          await wrapper.init
            .then((initStatus) => initStatus.tracerProvider.resource)
            .then((resource) => {
              checkBasicResourceAttributes(resource);

              const resourceAttributeKeys = Object.keys(resource.attributes);

              // Default ECS from upstream detector
              expect(resource.attributes['cloud.provider']).toBe('aws');
              expect(resource.attributes['cloud.platform']).toBe('aws_ecs');

              // These properties may left be blank in the test env
              expect(resourceAttributeKeys).toContain('container.id');
              expect(resourceAttributeKeys).toContain('container.name');

              expect(resource.attributes['aws.ecs.container.arn']).toBe(
                'arn:aws:ecs:us-west-2:111122223333:container/0206b271-b33f-47ab-86c6-a0ba208a70a9'
              );
              expect(resource.attributes['aws.ecs.cluster.arn']).toBe(
                'arn:aws:ecs:us-west-2:111122223333:cluster/default'
              );
              expect(resource.attributes['aws.ecs.launchtype']).toBe('EC2');
              expect(resource.attributes['aws.ecs.task.arn']).toBe(
                'arn:aws:ecs:us-west-2:111122223333:task/default/158d1c8083dd49d6b527399fd6414f5c'
              );
              expect(resource.attributes['aws.ecs.task.family']).toBe('curltest');
              expect(resource.attributes['aws.ecs.task.revision']).toBe('26');
            });
        });
      });
    });
  });

  describe('On Amazon EKS', () => {
    describe('on successful request', () => {
      jest.mock('@opentelemetry/resource-detector-aws', () => {
        return {
          ...jest.requireActual('@opentelemetry/resource-detector-aws'), // import and retain the original functionalities
          awsEksDetector: {
            detect: jest.fn().mockReturnValue(mockedResource),
          },
        };
      });

      test('NodeTracerProvider should be given a resource with all the right attributes', async () => {
        jest.isolateModules(async () => {
          process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
          process.env.OTEL_SERVICE_NAME = 'service-1';

          const wrapper = jest.requireActual('./wrapper');
          await wrapper.init
            .then((initStatus) => initStatus.tracerProvider.resource)
            .then((resource) => {
              checkBasicResourceAttributes(resource);
              const resourceAttributeKeys = Object.keys(resource.attributes);

              expect(resource.attributes[SemanticResourceAttributes.CLOUD_PROVIDER]).toBe('aws');
              expect(resource.attributes[SemanticResourceAttributes.CLOUD_PLATFORM]).toBe(
                'aws_eks'
              );
              expect(resourceAttributeKeys).toContain(SemanticResourceAttributes.CONTAINER_ID);
              expect(resourceAttributeKeys).toContain(SemanticResourceAttributes.K8S_CLUSTER_NAME);
            });
        });
      });
    });
  });
});

describe('NodeTracerProvider should be initialize with span limit according to environment variables or default', () => {
  test('NodeTracerProvider should be initialize with span limit equals to OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT', async () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = '1';
      const wrapper = jest.requireActual('./wrapper');
      await wrapper.init
        .then((initStatus) => initStatus.tracerProvider._config)
        .then((config) => {
          expect(config.spanLimits['attributeValueLengthLimit']).toBe(1);
        });
    });
  });

  test('NodeTracerProvider should be initialize with span limit equals to OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT', async () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '50';
      const wrapper = jest.requireActual('./wrapper');
      await wrapper.init
        .then((initStatus) => initStatus.tracerProvider._config)
        .then((config) => {
          expect(config.spanLimits['attributeValueLengthLimit']).toBe(50);
        });
    });
  });

  test('NodeTracerProvider should be initialize with span limit equals to default value', async () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      const wrapper = jest.requireActual('./wrapper');
      await wrapper.init
        .then((initStatus) => initStatus.tracerProvider._config)
        .then((config) => {
          expect(config.spanLimits['attributeValueLengthLimit']).toBe(2048);
        });
    });
  });

  test('NodeTracerProvider should be initialize with span limit equals to OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT when both env. vars set', async () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '50';
      process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = '1';
      const wrapper = jest.requireActual('./wrapper');
      await wrapper.init
        .then((initStatus) => initStatus.tracerProvider._config)
        .then((config) => {
          expect(config.spanLimits['attributeValueLengthLimit']).toBe(1);
        });
    });
  });

  describe('dependency reporting', () => {
    const ORIGINAL_PROCESS_ENV = process.env;

    beforeEach(() => {
      process.env = { ...ORIGINAL_PROCESS_ENV };
    });

    afterEach(() => {
      process.env = ORIGINAL_PROCESS_ENV;
      jest.clearAllMocks();
    });

    test('is disabled if LUMIGO_TRACER_TOKEN is not set', async () => {
      jest.isolateModules(async () => {
        const utils = require('./utils');
        jest.mock('./utils');

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => {
          return Promise.resolve();
        });

        const { init } = jest.requireActual('./wrapper');
        const { reportDependencies } = await init;

        await reportDependencies.finally(() => {
          expect(reportDependencies).resolves.toEqual('No Lumigo token available');
          expect(postUri).not.toHaveBeenCalled();
        });
      });
    });

    test('is disabled if the "LUMIGO_REPORT_DEPENDENCIES" set to something different than "true"', async () => {
      jest.isolateModules(async () => {
        process.env['LUMIGO_TRACER_TOKEN'] = 'abcdef';
        process.env['LUMIGO_REPORT_DEPENDENCIES'] = 'false';

        const utils = require('./utils');
        jest.mock('./utils');

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => {
          return Promise.resolve();
        });

        const { init } = jest.requireActual('./wrapper');
        const { reportDependencies } = await init;

        await reportDependencies.finally(() => {
          expect(reportDependencies).resolves.toEqual('Dependency reporting is turned off');
          expect(postUri).not.toHaveBeenCalled();
        });
      });
    });

    test('submits dependencies to the backend', async () => {
      jest.isolateModules(async () => {
        const lumigoToken = 'abcdef';
        process.env['LUMIGO_TRACER_TOKEN'] = lumigoToken;

        const utils = require('./utils');
        jest.mock('./utils');

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => {
          return Promise.resolve();
        });

        const { init } = jest.requireActual('./wrapper');
        const { reportDependencies } = await init;

        await reportDependencies.finally(async () => {
          const res = await reportDependencies;
          expect(res).toBeUndefined();

          expect(postUri.mock.calls.length).toBe(1);

          const [dependenciesEndpoint, data, headers] = postUri.mock.calls[0];

          expect(dependenciesEndpoint).not.toBeFalsy();
          expect(data.resourceAttributes['lumigo.distro.version']).toBe(version);
          expect(data.packages.length).toBeGreaterThan(0);
          expect(headers).toEqual({ Authorization: `LumigoToken ${lumigoToken}` });
        });
      });
    });

    test('handles correctly folders in node_modules without package.json inside', async () => {
      jest.isolateModules(async () => {
        const lumigoToken = 'abcdef';
        process.env['LUMIGO_TRACER_TOKEN'] = lumigoToken;

        const utils = require('./utils');
        jest.mock('./utils');

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => {
          return Promise.resolve();
        });

        await fs.promises.mkdir(join(__dirname, 'node_modules', 'foo'), { recursive: true });
        await fs.promises.mkdir(join(__dirname, 'node_modules', 'bar'), { recursive: true });

        const { init } = jest.requireActual('./wrapper');
        const { reportDependencies } = await init;

        await reportDependencies.finally(async () => {
          const res = await reportDependencies;
          expect(res).toBeUndefined();

          expect(postUri.mock.calls.length).toBe(1);

          const [dependenciesEndpoint, data, headers] = postUri.mock.calls[0];

          expect(dependenciesEndpoint).not.toBeFalsy();
          expect(data.resourceAttributes['lumigo.distro.version']).toBe(version);
          expect(data.packages.length).toBeGreaterThan(0);
          expect(headers).toEqual({ Authorization: `LumigoToken ${lumigoToken}` });
        });
      });
    });
  });
});

function checkBasicResourceAttributes(resource) {
  const resourceAttributeKeys = Object.keys(resource.attributes);

  expect(resourceAttributeKeys).toContain('telemetry.sdk.language');
  expect(resourceAttributeKeys).toContain('telemetry.sdk.name');
  expect(resourceAttributeKeys).toContain('telemetry.sdk.version');

  // Lumigo Distro Detector
  expect(resourceAttributeKeys).toContain('lumigo.distro.version');

  // Process detector
  expect(resourceAttributeKeys).toContain('process.command');
  expect(resourceAttributeKeys).toContain('process.command_line');
  expect(resourceAttributeKeys).toContain('process.executable.name');
  expect(resourceAttributeKeys).toContain('process.pid');
  expect(resourceAttributeKeys).toContain('process.runtime.name');
  expect(resourceAttributeKeys).toContain('process.runtime.description');
  expect(resourceAttributeKeys).toContain('process.runtime.version');
}
