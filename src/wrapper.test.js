import { ExpressInstrumentation } from 'opentelemetry-instrumentation-express';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

jest.mock('@opentelemetry/exporter-trace-otlp-http');
jest.mock('@opentelemetry/sdk-trace-node');
jest.mock('opentelemetry-instrumentation-express');
jest.mock('@opentelemetry/instrumentation-http');
jest.mock('@opentelemetry/sdk-trace-base');
jest.mock('@opentelemetry/instrumentation');
jest.mock('@opentelemetry/instrumentation-http');

const TOKEN = 't_10faa5e13e7844aaa1234';
const ENDPOINT = 'http://ec2-34-215-6-94.us-west-2.compute.amazonaws.com:55681/v1/trace';

describe('happy flow', () => {
  const ORIGINAL_PROCESS_ENV = process.env;
  const spies = {};
  spies.registerMock = jest.fn();
  spies.addSpanProcessorMock = jest.fn();
  NodeTracerProvider.mockImplementation(() => ({
    register: spies.registerMock,
    addSpanProcessor: spies.addSpanProcessorMock,
  }));
  OTLPTraceExporter.mockImplementation(() => ({}));

  beforeEach(() => {
    process.env = { ...ORIGINAL_PROCESS_ENV };
    Object.keys(spies).map((x) => spies[x].mockClear());
    OTLPTraceExporter.mockClear();
  });

  afterEach(() => {
    process.env = ORIGINAL_PROCESS_ENV;
  });

  test('NodeTracerProvider should have been called with config', async () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      const wrapper = jest.requireActual('./wrapper');
      wrapper.init.then(() => {
        expect(NodeTracerProvider).toHaveBeenCalledWith({
          resource: {
            attributes: {
              envs: expect.any(String),
              lumigoToken: 't_10faa5e13e7844aaa1234',
              'service.name': 'service-1',
              exporter: 'opentelemetry',
              framework: 'express',
              tracerVersion: expect.stringMatching(/\d+\.\d+\.\d+/),
              runtime: expect.stringMatching(/nodev\d+\.\d+\.\d+/),
            },
          },
        });
        expect(spies.registerMock).toHaveBeenCalled();
        expect(spies.addSpanProcessorMock).toHaveBeenCalled();
      });
    });
  });

  test('Trim whitespaces in token', () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = ' t_10faa5e13e7844aaa1234   ';
      process.env.OTEL_SERVICE_NAME = 'service-1';
      jest.requireActual('./wrapper');

      expect(NodeTracerProvider).toHaveBeenCalledWith({
        resource: {
          attributes: {
            envs: expect.any(String),
            lumigoToken: 't_10faa5e13e7844aaa1234',
            'service.name': 'service-1',
            exporter: 'opentelemetry',
            framework: 'express',
            tracerVersion: expect.stringMatching(/\d+\.\d+\.\d+/),
            runtime: expect.stringMatching(/nodev\d+\.\d+\.\d+/),
          },
        },
      });
    });
  });

  test('OTLPTraceExporter should have been called with config', () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      process.env.LUMIGO_ENDPOINT = ENDPOINT;
      jest.requireActual('./wrapper');

      expect(OTLPTraceExporter).toHaveBeenCalledWith({
        headers: {
          Authorization: 'LumigoToken t_10faa5e13e7844aaa1234',
        },
        url: ENDPOINT,
      });
    });
  });

  test('ExpressInstrumentation should have been called', () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      process.env.LUMIGO_ENDPOINT = ENDPOINT;
      jest.requireActual('./wrapper');

      expect(ExpressInstrumentation).toHaveBeenCalled();
    });
  });

  test('HttpInstrumentation should have been called', () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      process.env.LUMIGO_ENDPOINT = ENDPOINT;
      jest.requireActual('./wrapper');

      expect(HttpInstrumentation).toHaveBeenCalled();
    });
  });

  test('BatchSpanProcessor should have been called', () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      process.env.LUMIGO_ENDPOINT = ENDPOINT;
      jest.requireActual('./wrapper');

      expect(BatchSpanProcessor).toHaveBeenCalled();
    });
  });

  test('registerInstrumentations should have been called', () => {
    jest.isolateModules(async () => {
      process.env.LUMIGO_TRACER_TOKEN = TOKEN;
      process.env.OTEL_SERVICE_NAME = 'service-1';
      process.env.LUMIGO_ENDPOINT = ENDPOINT;
      jest.requireActual('./wrapper');

      expect(registerInstrumentations).toHaveBeenCalled();
    });
  });

  describe("with the 'LUMIGO_SWITCH_OFF' environment variable set to 'true'", () => {
    it('should not invoke trace initialization', async () => {
      process.env.LUMIGO_SWITCH_OFF = 'true';

      jest.isolateModules(async () => {
        const wrapper = jest.requireActual('./wrapper');

        const sdkInitialized = await wrapper.init;

        expect(OTLPTraceExporter).not.toHaveBeenCalled();
        expect(sdkInitialized).toBeUndefined();
        expect(logger.info).toBeCalledWith(
          'Lumigo OpenTelemetry Distro is switched off, no telemetry will be collected'
        );
      });
    });
  });
});
