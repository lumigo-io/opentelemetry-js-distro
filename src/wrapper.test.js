const wrapper = require('../src/wrapper');

jest.mock('@opentelemetry/node');
jest.mock('@opentelemetry/exporter-collector');
jest.mock('opentelemetry-instrumentation-aws-sdk');
jest.mock('@opentelemetry/instrumentation-express');
jest.mock('@opentelemetry/instrumentation-http');
jest.mock('@opentelemetry/tracing');
jest.mock('@opentelemetry/instrumentation');
const { NodeTracerProvider } = require('@opentelemetry/node');
const { CollectorTraceExporter } = require('@opentelemetry/exporter-collector');
const { AwsInstrumentation } = require('opentelemetry-instrumentation-aws-sdk');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { BatchSpanProcessor } = require('@opentelemetry/tracing');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

const TOKEN = 't_10faa5e13e7844aaa1234';
const ENDPOINT = 'http://ec2-34-215-6-94.us-west-2.compute.amazonaws.com:55681/v1/trace';

describe('happy flow', () => {
  const spies = {};
  spies.registerMock = jest.fn();
  spies.addSpanProcessorMock = jest.fn();
  NodeTracerProvider.mockImplementation(() => ({
    register: spies.registerMock,
    addSpanProcessor: spies.addSpanProcessorMock,
  }));
  CollectorTraceExporter.mockImplementation(() => ({}));
  beforeEach(() => {
    Object.keys(spies).map((x) => spies[x].mockClear());
    CollectorTraceExporter.mockClear();
  });

  test('NodeTracerProvider should have been called with config', () => {
    wrapper.trace(TOKEN, 'service-1');
    expect(NodeTracerProvider).toHaveBeenCalledWith({
      plugins: {
        'aws-sdk': {
          enabled: false,
          path: 'opentelemetry-plugin-aws-sdk',
        },
      },
      resource: {
        attributes: {
          lumigoToken: 't_10faa5e13e7844aaa1234',
          'service.name': 'service-1',
        },
      },
    });
    expect(spies.registerMock).toHaveBeenCalled();
    expect(spies.addSpanProcessorMock).toHaveBeenCalled();
  });

  test('Trim whitespaces in token', () => {
    wrapper.trace(" t_10faa5e13e7844aaa1234   ", 'service-1');
    expect(NodeTracerProvider).toHaveBeenCalledWith({
      plugins: {
        'aws-sdk': {
          enabled: false,
          path: 'opentelemetry-plugin-aws-sdk',
        },
      },
      resource: {
        attributes: {
          lumigoToken: 't_10faa5e13e7844aaa1234',
          'service.name': 'service-1',
        },
      },
    });
  });

  test('CollectorTraceExporter should have been called with config', () => {
    wrapper.trace(TOKEN, 'service-1', ENDPOINT);
    expect(CollectorTraceExporter).toHaveBeenCalledWith({
      serviceName: 'service-1',
      url: ENDPOINT,
    });
  });

  test('AwsInstrumentation should have been called with config', () => {
    wrapper.trace(TOKEN, 'service-1', ENDPOINT);
    expect(AwsInstrumentation).toHaveBeenCalledWith({
      suppressInternalInstrumentation: true,
    });
  });

  test('ExpressInstrumentation should have been called', () => {
    wrapper.trace(TOKEN, 'service-1', ENDPOINT);
    expect(ExpressInstrumentation).toHaveBeenCalled();
  });

  test('HttpInstrumentation should have been called', () => {
    wrapper.trace(TOKEN, 'service-1', ENDPOINT);
    expect(HttpInstrumentation).toHaveBeenCalled();
  });

  test('BatchSpanProcessor should have been called', () => {
    wrapper.trace(TOKEN, 'service-1', ENDPOINT);
    expect(BatchSpanProcessor).toHaveBeenCalled();
  });

  test('registerInstrumentations should have been called', () => {
    wrapper.trace(TOKEN, 'service-1', ENDPOINT);
    expect(registerInstrumentations).toHaveBeenCalled();
  });

  test('if LUMIGO_SWITCH_OFF set to TRUE traece should return without instrumentation', () => {
    process.env.LUMIGO_SWITCH_OFF = 'TRUE';
    wrapper.trace(TOKEN, 'service-1', ENDPOINT);
    expect(CollectorTraceExporter).not.toHaveBeenCalled();
    process.env.LUMIGO_SWITCH_OFF = undefined;
  });
});
