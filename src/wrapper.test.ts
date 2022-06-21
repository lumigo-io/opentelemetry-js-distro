import * as api from '@opentelemetry/api';
import { DiagLogger } from '@opentelemetry/api';
import * as otlp from '@opentelemetry/exporter-trace-otlp-http';
import * as exporters from './exporters';

jest.mock('@opentelemetry/api');
jest.mock('@opentelemetry/exporter-trace-otlp-http');
jest.mock('./exporters');

const TOKEN = 't_10faa5e13e7844aaa1234';
const ENDPOINT = 'http://ec2-34-215-6-94.us-west-2.compute.amazonaws.com:55681/v1/trace';
// Do not change this without talking to Product :-)
// Also, do NOT just import the constant from wrapper, tests should go RED if you change it.
const DEFAULT_LUMIGO_ENDPOINT = 'https://ga-otlp.lumigo-tracer-edge.golumigo.com/v1/traces';

describe('Distro initialization', () => {
  const logger: DiagLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.spyOn(api.diag, 'createComponentLogger').mockImplementation(() => logger);

    process.env = { ...OLD_ENV }; // Make a copy of env so that we can alter it in tests
  });

  afterEach(() => {
    process.env = OLD_ENV; // Restore old environment
    jest.resetAllMocks();
  });

  describe("with the 'LUMIGO_SWITCH_OFF' environment variable set to 'true'", () => {
    it("should not invoke 'initializeTracer'", async () => {
      process.env.LUMIGO_SWITCH_OFF = 'true';

      jest.isolateModules(async () => {
        const wrapper = require('./wrapper');

        const sdkInitialized = await wrapper.sdkInit;

        expect(sdkInitialized).toBeUndefined();
        expect(logger.info).toBeCalledWith(
          'Lumigo OpenTelemetry Distro is switched off, no telemetry will be collected'
        );
      });
    });
  });

  describe("with no 'LUMIGO_TRACER_TOKEN' environment variable set", () => {
    it('should warn that no data will be sent to Lumigo', async () => {
      jest.isolateModules(async () => {
        const wrapper = require('./wrapper');

        const sdkInitialized = await wrapper.sdkInit;

        expect(sdkInitialized).not.toBeUndefined();
        expect(logger.warn).toBeCalledWith(
          "Lumigo token not provided (env var 'LUMIGO_TRACER_TOKEN' not set); no data will be sent to Lumigo"
        );
        expect(otlp.OTLPTraceExporter).not.toBeCalled();
      });
    });
  });

  describe("with the 'LUMIGO_TRACER_TOKEN' environment variable set", () => {
    beforeEach(() => {
      process.env.LUMIGO_TRACER_TOKEN = TOKEN;
    });

    it('should initialize an OTLPTraceExporter', async () => {
      jest.isolateModules(async () => {
        const wrapper = require('./wrapper');

        const sdkInitialized = await wrapper.sdkInit;

        expect(sdkInitialized).not.toBeUndefined();
        expect(otlp.OTLPTraceExporter).toBeCalledWith({
          url: DEFAULT_LUMIGO_ENDPOINT,
          headers: {
            Authorization: `LumigoToken ${TOKEN}`,
          },
        });
        expect(logger.debug).toBeCalledWith('Lumigo OpenTelemetry Distro initialized');
      });
    });

    describe("with the 'LUMIGO_ENDPOINT' environment variable set", () => {
      beforeEach(() => {
        process.env.LUMIGO_ENDPOINT = ENDPOINT;
      });

      it('should initialize an OTLPTraceExporter', async () => {
        jest.isolateModules(async () => {
          const wrapper = require('./wrapper');

          const sdkInitialized = await wrapper.sdkInit;

          expect(sdkInitialized).not.toBeUndefined();
          expect(otlp.OTLPTraceExporter).toBeCalledWith({
            url: ENDPOINT,
            headers: {
              Authorization: `LumigoToken ${TOKEN}`,
            },
          });
          expect(logger.debug).toBeCalledWith('Lumigo OpenTelemetry Distro initialized');
        });
      });
    });

    describe("with also the 'LUMIGO_DEBUG_SPANDUMP' environment variable set", () => {
      beforeEach(() => {
        process.env.LUMIGO_DEBUG_SPANDUMP = 'test.json';
      });

      it('should initialize a FileSpanExporter', async () => {
        jest.isolateModules(async () => {
          const wrapper = require('./wrapper');

          const sdkInitialized = await wrapper.sdkInit;

          expect(sdkInitialized).not.toBeUndefined();
          expect(otlp.OTLPTraceExporter).toBeCalledWith({
            url: DEFAULT_LUMIGO_ENDPOINT,
            headers: {
              Authorization: `LumigoToken ${TOKEN}`,
            },
          });
          expect(exporters.FileSpanExporter).toBeCalledWith('test.json');
          expect(logger.debug).toBeCalledWith('Lumigo OpenTelemetry Distro initialized');
        });
      });
    });
  });

  describe("with 'LUMIGO_DEBUG_SPANDUMP' environment variable set", () => {
    beforeEach(() => {
      process.env.LUMIGO_DEBUG_SPANDUMP = 'test.json';
    });

    it('should initialize a FileSpanExporter', async () => {
      jest.isolateModules(async () => {
        const wrapper = require('./wrapper');

        const sdkInitialized = await wrapper.sdkInit;

        expect(sdkInitialized).not.toBeUndefined();
        expect(exporters.FileSpanExporter).toBeCalledWith('test.json');
        expect(logger.debug).toBeCalledWith('Lumigo OpenTelemetry Distro initialized');
      });
    });
  });

  it('should create process attributes in the resource', async () => {
    const wrapper = require('./wrapper');

    const sdkInitialized = await wrapper.sdkInit;

    expect(sdkInitialized).not.toBeUndefined();

    const resource = sdkInitialized.traceProvider.resource;

    /*
     * NOTE: the attribute names here are spelled out as strings rather than refer to
     * exported constants of '@opentelemetry/semantic-conventions' because if the exported
     * values change, we must notice to account for it in the backend.
     */

    // SDK base properties
    expect(resource.attributes).toHaveProperty('telemetry.sdk.name');
    expect(resource.attributes).toHaveProperty('telemetry.sdk.language');
    expect(resource.attributes).toHaveProperty('telemetry.sdk.version');

    // Lumigo Distro attributes
    expect(resource.attributes).toHaveProperty('lumigo.distro.version');

    // Process attributes
    expect(resource.attributes).toHaveProperty('process.pid');
    expect(resource.attributes).toHaveProperty('process.runtime.description');
    expect(resource.attributes).toHaveProperty('process.runtime.name');
    expect(resource.attributes).toHaveProperty('process.runtime.version');
  });

  describe('with the OTEL_RESOURCE_ATTRIBUTES and OTEL_SERVICE_NAME environment variables set', () => {
    beforeEach(() => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'foo=bar';
      process.env.OTEL_SERVICE_NAME = 'awesomesauce';
    });

    it('should create additional attributes in the resource', async () => {
      const wrapper = require('./wrapper');

      const sdkInitialized = await wrapper.sdkInit;

      expect(sdkInitialized).not.toBeUndefined();

      const resource = sdkInitialized.traceProvider.resource;
      expect(resource.attributes).toMatchObject({
        'service.name': 'awesomesauce',
      });
      expect(resource.attributes).toMatchObject({
        foo: 'bar',
      });
    });
  });
});
