import * as fs from 'fs';
import { join } from 'path';

const LUMIGO_ENDPOINT = 'http://ec2-34-215-6-94.us-west-2.compute.amazonaws.com:55681/v1/trace';
const LUMIGO_TRACER_TOKEN = 't_10faa5e13e7844aaa1234';

const ECS_CONTAINER_METADATA_URI_V4 =
  'http://169.255.169.255:12345/v4/96d36db6cf2942269b2c2c0c9540c444-4190541037';
const ECS_CONTAINER_METADATA_URI = 'http://169.255.169.255/v3';

const { version } = require('../package.json');

describe('Distro initialization', () => {
  const ORIGINAL_PROCESS_ENV = process.env;

  afterAll(() => {
    process.env = ORIGINAL_PROCESS_ENV;
  });

  beforeEach(() => {
    /*
     * We have a limit on the size of env we sent to the backend, and the env
     * in the CI/CD goes over the limit, so the additional env vars we want to
     * check for scrubbing get dropped.
     */
    process.env = {};
  });

  afterEach(() => {
    process.env = {};
    jest.resetAllMocks();
    jest.resetModules();
  });

  describe("with the 'LUMIGO_SWITCH_OFF' environment variable set to 'true'", () => {
    test('should not invoke trace initialization', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_SWITCH_OFF = 'true';

        const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
        jest.mock('@opentelemetry/exporter-trace-otlp-http');

        const { init } = jest.requireActual('./wrapper');
        const sdkInitialized = await init;

        expect(OTLPTraceExporter).not.toHaveBeenCalled();
        expect(sdkInitialized).toBeUndefined();
      });
    });
  });

  describe('secret keys', () => {
    test('should be redacted by LUMIGO_SECRET_MASKING_REGEX from env vars', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
        process.env.LUMIGO_SECRET_MASKING_REGEX = '["VAR_TO_MASK"]';
        process.env.VAR_TO_MASK = 'some value';

        const { init } = jest.requireActual('./wrapper');
        const { tracerProvider } = await init;
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

        const { init } = jest.requireActual('./wrapper');
        const { tracerProvider } = await init;
        const resource = tracerProvider.resource;

        const vars = JSON.parse(resource.attributes['process.environ']);
        expect(vars.AUTHORIZATION).toEqual('****');
      });
    });
  });

  describe('with the LUMIGO_TRACER_TOKEN environment variable set', () => {
    test('should initialize the OTLPTraceExporter', async () => {
      await jest.isolateModulesAsync(async () => {
        const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
        jest.mock('@opentelemetry/exporter-trace-otlp-http');

        process.env.LUMIGO_ENDPOINT = LUMIGO_ENDPOINT;
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';

        const { init } = jest.requireActual('./wrapper');
        await init;

        expect(OTLPTraceExporter).toHaveBeenCalledWith({
          headers: {
            Authorization: 'LumigoToken t_10faa5e13e7844aaa1234',
          },
          url: LUMIGO_ENDPOINT,
        });
      });
    });

    describe('with the LUMIGO_DEBUG_SPANDUMP variable set', () => {
      test('should initialize the FileSpanExporter', async () => {
        await jest.isolateModulesAsync(async () => {
          process.env.LUMIGO_DEBUG_SPANDUMP = '/dev/stdout';
          process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';

          const { FileSpanExporter } = require('./exporters');
          jest.mock('./exporters');

          const { init } = jest.requireActual('./wrapper');
          await init;

          expect(FileSpanExporter).toHaveBeenCalledWith('/dev/stdout');
        });
      });
    });
  });

  describe('without the LUMIGO_TRACER_TOKEN environment variable set', () => {
    test('should not initialize the OTLPTraceExporter', async () => {
      await jest.isolateModulesAsync(async () => {
        const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
        jest.mock('@opentelemetry/exporter-trace-otlp-http');

        const { init } = jest.requireActual('./wrapper');
        await init;

        expect(OTLPTraceExporter).not.toHaveBeenCalled();
      });
    });

    describe('with the LUMIGO_DEBUG_SPANDUMP variable set', () => {
      test('should initialize the FileSpanExporter', async () => {
        await jest.isolateModulesAsync(async () => {
          process.env.LUMIGO_DEBUG_SPANDUMP = '/dev/stdout';

          jest.mock('./exporters');

          const { init } = jest.requireActual('./wrapper');
          await init;

          const { FileSpanExporter } = require('./exporters');
          expect(FileSpanExporter).toHaveBeenCalledWith('/dev/stdout');
        });
      });
    });
  });

  describe('outside of a computing platform for which we have detectors', () => {
    test('NodeTracerProvider should be given a resource with all the right attributes', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
        process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';

        const { init } = jest.requireActual('./wrapper');
        const { tracerProvider } = await init;
        const resource = tracerProvider.resource;

        expect(resource.attributes['framework']).toBe('node');
        expect(resource.attributes['service.name']).toBe('service-1');

        checkBasicResourceAttributes(resource);
      });
    });
  });

  describe('On Amazon ECS', () => {
    beforeEach(() => {
      process.env.ECS_CONTAINER_METADATA_URI = ECS_CONTAINER_METADATA_URI;
      process.env.LUMIGO_REPORT_DEPENDENCIES = 'false';

      // Mock the access to the /proc/sef/cgroup file, of the AWS detector will fail
      jest.mock('fs', () => ({
        ...jest.requireActual('fs'),
        readFile: jest.fn().mockImplementation((path, options, callback) => {
          if (path === '/proc/sef/cgroup') {
            callback('some_cgroup');
          }

          const fs = jest.requireActual('fs');
          return fs.readFile(path, options, callback);
        }),
      }));
    });

    test('NodeTracerProvider should be given a resource with ECS attributes', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';

        const { init } = jest.requireActual('./wrapper');
        const { tracerProvider } = await init;
        const resource = tracerProvider.resource;

        checkBasicResourceAttributes(resource);

        // Default ECS from upstream detector
        expect(resource.attributes['cloud.provider']).toBe('aws');
        expect(resource.attributes['cloud.platform']).toBe('aws_ecs');
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

        const { init } = jest.requireActual('./wrapper');
        const { tracerProvider } = await init;

        expect(tracerProvider._config.spanLimits['attributeValueLengthLimit']).toBe(1);
      });
    });

    test('NodeTracerProvider should be initialize with span limit equals to OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
        process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '50';

        const { init } = jest.requireActual('./wrapper');
        const { tracerProvider } = await init;

        expect(tracerProvider._config.spanLimits['attributeValueLengthLimit']).toBe(50);
      });
    });

    test('NodeTracerProvider should be initialize with span limit equals to default value', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';

        const { init } = jest.requireActual('./wrapper');
        const { tracerProvider } = await init;

        expect(tracerProvider._config.spanLimits['attributeValueLengthLimit']).toBe(2048);
      });
    });

    test('NodeTracerProvider should be initialize with span limit equals to OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT when both env. vars set', async () => {
      await jest.isolateModulesAsync(async () => {
        process.env.LUMIGO_TRACER_TOKEN = LUMIGO_TRACER_TOKEN;
        process.env.OTEL_SERVICE_NAME = 'service-1';
        process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '50';
        process.env.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = '1';

        const { init } = jest.requireActual('./wrapper');
        const { tracerProvider } = await init;

        expect(tracerProvider._config.spanLimits['attributeValueLengthLimit']).toBe(1);
      });
    });
  });

  describe('dependency reporting', () => {
    test('is disabled if LUMIGO_TRACER_TOKEN is not set', async () => {
      await jest.isolateModulesAsync(async () => {
        const utils = require('./utils');
        jest.mock('./utils');

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => Promise.resolve());

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

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => Promise.resolve());

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

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => Promise.resolve());

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

    test('does not fail if dependency submission fails', async () => {
      await jest.isolateModulesAsync(async () => {
        const lumigoToken = 'abcdef';
        process.env.LUMIGO_TRACER_TOKEN = lumigoToken;

        const utils = require('./utils');
        jest.mock('./utils');

        const postUri = jest
          .spyOn(utils, 'postUri')
          .mockImplementation(() => Promise.reject(new Error('FAIL!')));

        const { init } = jest.requireActual('./wrapper');
        const { reportDependencies } = await init;

        const res = await reportDependencies;
        expect(res).toBeUndefined();

        expect(postUri.mock.calls.length).toBe(1);

        const [dependenciesEndpoint, data, headers] = postUri.mock.calls[0];

        expect(dependenciesEndpoint).not.toBeFalsy();
        expect(data.resourceAttributes['telemetry.sdk.language']).toBe('nodejs');
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

        const postUri = jest.spyOn(utils, 'postUri').mockImplementation(() => Promise.resolve());

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
