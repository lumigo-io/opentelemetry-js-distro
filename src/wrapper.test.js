import * as fs from 'fs';

/*
 * Monkey-patch jest to be able to handle async in isolateModules
 *
 * See https://github.com/facebook/jest/issues/10428
 */

async function isolateModulesAsync(fn) {
  if (this._isolatedModuleRegistry || this._isolatedMockRegistry) {
    throw new Error('isolateModules cannot be nested inside another isolateModules.');
  }

  this._isolatedModuleRegistry = new Map();
  this._isolatedMockRegistry = new Map();

  try {
    await fn();
  } finally {
    var _this$_isolatedModule, _this$_isolatedMockRe2;

    // might be cleared within the callback
    (_this$_isolatedModule = this._isolatedModuleRegistry) === null ||
    _this$_isolatedModule === void 0
      ? void 0
      : _this$_isolatedModule.clear();
    (_this$_isolatedMockRe2 = this._isolatedMockRegistry) === null ||
    _this$_isolatedMockRe2 === void 0
      ? void 0
      : _this$_isolatedMockRe2.clear();
    this._isolatedModuleRegistry = null;
    this._isolatedMockRegistry = null;

    return this;
  }
}
jest.isolateModulesAsync = isolateModulesAsync.bind(jest);

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

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { join } from 'path';
jest.mock('@opentelemetry/exporter-trace-otlp-http');

const LUMIGO_ENDPOINT = 'http://ec2-34-215-6-94.us-west-2.compute.amazonaws.com:55681/v1/trace';
const LUMIGO_TRACER_TOKEN = 't_10faa5e13e7844aaa1234';

const ECS_CONTAINER_METADATA_URI_V4 = 'http://169.255.169.255/metadata/v4';
const ECS_CONTAINER_METADATA_URI = 'http://169.255.169.255/metadata/v3';

const { version } = require('../package.json');

describe('Distro initialization', () => {
  const ORIGINAL_PROCESS_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_PROCESS_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_PROCESS_ENV;
    jest.resetAllMocks();
  });

  describe("with the 'LUMIGO_SWITCH_OFF' environment variable set to 'true'", () => {
    test('should not invoke trace initialization', async () => {
      process.env.LUMIGO_SWITCH_OFF = 'true';

      await jest.isolateModulesAsync(async () => {
        const wrapper = jest.requireActual('./wrapper');

        const sdkInitialized = await wrapper.init;

        expect(OTLPTraceExporter).not.toHaveBeenCalled();
        expect(sdkInitialized).toBeUndefined();
      });
    });
  });

  describe('secret keys', () => {
    beforeEach(() => {
      /*
       * We have a limit on the size of env we sent to the backend, and the env
       * in the CI/CD goes over the limit, so the additional env vars we want to
       * check for scrubbing get dropped.
       */
      process.env = {};
    });

    test('should be redacted from env vars by LUMIGO_SECRET_MASKING_REGEX', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
        process.env.LUMIGO_SECRET_MASKING_REGEX = '["VAR_TO_MASK"]';
        process.env.VAR_TO_MASK = 'some value';

        const wrapper = jest.requireActual('./wrapper');
        const { tracerProvider } = await wrapper.init;
        const resource = tracerProvider.resource;

        const vars = JSON.parse(resource.attributes['process.environ']);
        expect(vars.VAR_TO_MASK).toEqual('****');
      });
    });

    test('should be redacted from env vars', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
        process.env.AUTHORIZATION = 'some value';

        const wrapper = jest.requireActual('./wrapper');
        const { tracerProvider } = await wrapper.init;
        const resource = tracerProvider.resource;

        const vars = JSON.parse(resource.attributes['process.environ']);
        expect(vars.AUTHORIZATION).toEqual('****');
      });
    });
  });

  describe('with the LUMIGO_TRACER_TOKEN environment variable set', () => {
    beforeEach(() => {
      process.env.LUMIGO_ENDPOINT = LUMIGO_ENDPOINT;
      process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
      process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';
    });

    test('should initialize the OTLPTraceExporter', async () => {
      await jest.isolateModulesAsync(async () => {
        const wrapper = jest.requireActual('./wrapper');
        await wrapper.init;

        expect(OTLPTraceExporter).toHaveBeenCalledWith({
          headers: {
            Authorization: 'LumigoToken t_10faa5e13e7844aaa1234',
          },
          url: LUMIGO_ENDPOINT,
        });
      });
    });

    describe('with the LUMIGO_DEBUG_SPANDUMP variable set', () => {
      beforeEach(() => {
        process.env.LUMIGO_DEBUG_SPANDUMP = '/dev/stdout';
        process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';
      });

      test('should initialize the FileSpanExporter', async () => {
        await jest.isolateModulesAsync(async () => {
          const wrapper = jest.requireActual('./wrapper');
          await wrapper.init;

          expect(FileSpanExporter).toHaveBeenCalledWith('/dev/stdout');
        });
      });
    });
  });

  describe('without the LUMIGO_TRACER_TOKEN environment variable set', () => {
    test('should not initialize the OTLPTraceExporter', async () => {
      await jest.isolateModulesAsync(async () => {
        const wrapper = jest.requireActual('./wrapper');
        await wrapper.init;

        expect(OTLPTraceExporter).not.toHaveBeenCalled();
      });
    });

    describe('with the LUMIGO_DEBUG_SPANDUMP variable set', () => {
      beforeEach(() => {
        process.env.LUMIGO_DEBUG_SPANDUMP = '/dev/stdout';
      });

      test('should initialize the FileSpanExporter', async () => {
        await jest.isolateModulesAsync(async () => {
          const wrapper = jest.requireActual('./wrapper');
          await wrapper.init;

          expect(FileSpanExporter).toHaveBeenCalledWith('/dev/stdout');
        });
      });
    });
  });

  describe('outside of a computing platform for which we have detectors', () => {
    beforeEach(() => {
      process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';
    });

    test('NodeTracerProvider should be given a resource with all the right attributes', async () => {
      await jest.isolateModulesAsync(async () => {
        const wrapper = jest.requireActual('./wrapper');
        const { tracerProvider } = await wrapper.init;
        const resource = tracerProvider.resource;

        expect(resource.attributes['framework']).toBe('node');
        expect(resource.attributes['service.name']).toBe('service-1');

        checkBasicResourceAttributes(resource);
      });
    });
  });

  describe('On Amazon ECS', () => {
    beforeEach(() => {
      process.env = { ...ORIGINAL_PROCESS_ENV };
      process.env.ECS_CONTAINER_METADATA_URI = ECS_CONTAINER_METADATA_URI;
      process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';
    });

    describe('without the Task Metadata V4 endpoint', () => {
      beforeEach(() => {
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
      });

      test('NodeTracerProvider should be given a resource with all the right attributes', async () => {
        await jest.isolateModulesAsync(async () => {
          const wrapper = jest.requireActual('./wrapper');
          const { tracerProvider } = await wrapper.init;
          const resource = tracerProvider.resource;

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

    describe('with the Task Metadata V4 endpoint', () => {
      async function mockMetadataGetUri(url) {
        let responseFilepath;
        switch (url) {
          case ECS_CONTAINER_METADATA_URI_V4:
            responseFilepath =
              __dirname + '/resources/detectors/test-resources/metadatav4-response-container.json';
            break;
          case `${ECS_CONTAINER_METADATA_URI_V4}/task`:
            responseFilepath =
              __dirname + '/resources/detectors/test-resources/metadatav4-response-task.json';
            break;
          default:
            throw new Error(`Unexpected url '${url}`);
        }
        return fs.promises.readFile(responseFilepath).then(JSON.parse);
      }

      beforeEach(() => {
        process.env.ECS_CONTAINER_METADATA_URI_V4 = ECS_CONTAINER_METADATA_URI_V4;
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
      });

      test('NodeTracerProvider should be given a resource with all the right attributes', async () => {
        await jest.isolateModulesAsync(async () => {
          jest.mock('./utils', () => ({
            ...jest.requireActual('./utils'), // import and retain the original functionalities
            getUri: mockMetadataGetUri,
          }));

          const wrapper = jest.requireActual('./wrapper');
          const { tracerProvider } = await wrapper.init;
          const resource = tracerProvider.resource;

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

  describe('On Amazon EKS', () => {
    beforeEach(() => {
      process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';
    });

    describe('on successful request', () => {
      test('NodeTracerProvider should be given a resource with all the right attributes', async () => {
        jest.mock('@opentelemetry/resource-detector-aws', () => {
          return {
            ...jest.requireActual('@opentelemetry/resource-detector-aws'), // import and retain the original functionalities
            awsEksDetector: {
              detect: jest.fn().mockReturnValue(mockedResource),
            },
          };
        });

        await jest.isolateModulesAsync(async () => {
          process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
          process.env.OTEL_SERVICE_NAME = 'service-1';

          const wrapper = jest.requireActual('./wrapper');
          const { tracerProvider } = await wrapper.init;
          const resource = tracerProvider.resource;

          checkBasicResourceAttributes(resource);
          const resourceAttributeKeys = Object.keys(resource.attributes);

          expect(resource.attributes[SemanticResourceAttributes.CLOUD_PROVIDER]).toBe('aws');
          expect(resource.attributes[SemanticResourceAttributes.CLOUD_PLATFORM]).toBe('aws_eks');
          expect(resourceAttributeKeys).toContain(SemanticResourceAttributes.CONTAINER_ID);
          expect(resourceAttributeKeys).toContain(SemanticResourceAttributes.K8S_CLUSTER_NAME);
        });
      });
    });
  });

  describe('NodeTracerProvider should be initialize with span limit according to environment variables or default', () => {
    beforeEach(() => {
      process.env = { ...ORIGINAL_PROCESS_ENV };
      process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';
    });

    test('NodeTracerProvider should be initialize with span limit equals to OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
        process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = '1';

        const wrapper = jest.requireActual('./wrapper');
        const { tracerProvider } = await wrapper.init;

        expect(tracerProvider._config.spanLimits['attributeValueLengthLimit']).toBe(1);
      });
    });

    test('NodeTracerProvider should be initialize with span limit equals to OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
        process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '50';

        const wrapper = jest.requireActual('./wrapper');
        const { tracerProvider } = await wrapper.init;

        expect(tracerProvider._config.spanLimits['attributeValueLengthLimit']).toBe(50);
      });
    });

    test('NodeTracerProvider should be initialize with span limit equals to default value', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';

        const wrapper = jest.requireActual('./wrapper');
        const { tracerProvider } = await wrapper.init;

        expect(tracerProvider._config.spanLimits['attributeValueLengthLimit']).toBe(2048);
      });
    });

    test('NodeTracerProvider should be initialize with span limit equals to OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT when both env. vars set', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
        process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '50';
        process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = '1';

        const wrapper = jest.requireActual('./wrapper');
        const { tracerProvider } = await wrapper.init;

        expect(tracerProvider._config.spanLimits['attributeValueLengthLimit']).toBe(1);
      });
    });
  });

  describe('dependency reporting', () => {
    test('is disabled if LUMIGO_TRACER_TOKEN is not set', async () => {
      await jest.isolateModulesAsync(async () => {
        const utils = require('./utils');
        jest.mock('./utils');

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => {
          return Promise.resolve();
        });

        const { init } = jest.requireActual('./wrapper');
        const { reportDependencies } = await init;

        expect(reportDependencies).resolves.toEqual('No Lumigo token available');
        expect(postUri).not.toHaveBeenCalled();
      });
    });

    test('is disabled if the "LUMIGO_REPORT_DEPENDENCIES" set to something different than "true"', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_TRACER_TOKEN = 'abcdef';
        process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';

        const utils = require('./utils');
        jest.mock('./utils');

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => {
          return Promise.resolve();
        });

        const { init } = jest.requireActual('./wrapper');
        const { reportDependencies } = await init;

        expect(reportDependencies).resolves.toEqual('Dependency reporting is turned off');
        expect(postUri).not.toHaveBeenCalled();
      });
    });

    test('submits dependencies to the backend', async () => {
      await jest.isolateModulesAsync(async () => {
        const lumigoToken = 'abcdef';
        process.env.LUMIGO_TRACER_TOKEN = lumigoToken;

        const utils = require('./utils');
        jest.mock('./utils');

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => {
          return Promise.resolve();
        });

        const { init } = jest.requireActual('./wrapper');
        const { reportDependencies } = await init;

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

    test('handles correctly folders in node_modules without package.json inside', async () => {
      await jest.isolateModulesAsync(async () => {
        const lumigoToken = 'abcdef';
        process.env.LUMIGO_TRACER_TOKEN = lumigoToken;

        const utils = require('./utils');
        jest.mock('./utils');

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => {
          return Promise.resolve();
        });

        await fs.promises.mkdir(join(__dirname, 'node_modules', 'foo'), { recursive: true });
        await fs.promises.mkdir(join(__dirname, 'node_modules', 'bar'), { recursive: true });

        const { init } = jest.requireActual('./wrapper');
        const { reportDependencies } = await init;

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
