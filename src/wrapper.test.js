const wrapper = require('../src/wrapper');

jest.mock('@opentelemetry/exporter-trace-otlp-http');
jest.mock('@opentelemetry/sdk-trace-node');
jest.mock('opentelemetry-instrumentation-express');
jest.mock('@opentelemetry/instrumentation-http');
jest.mock('@opentelemetry/sdk-trace-base');
jest.mock('@opentelemetry/instrumentation');
jest.mock('@opentelemetry/instrumentation-http');
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from 'opentelemetry-instrumentation-express';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

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
  OTLPTraceExporter.mockImplementation(() => ({}));
  beforeEach(() => {
    wrapper.clearIsTraced()
    Object.keys(spies).map((x) => spies[x].mockClear());
    OTLPTraceExporter.mockClear();
  });

  test('NodeTracerProvider should have been called with config', () => {
    wrapper.trace(TOKEN, 'service-1');
    expect(NodeTracerProvider).toHaveBeenCalledWith({
      resource: {
        attributes: {
          envs: expect.any(String),
          lumigoToken: 't_10faa5e13e7844aaa1234',
          'service.name': 'service-1',
          exporter: 'opentelemetry',
          framework: 'express',
          tracerVersion: '1.0.15',
          runtime: 'nodev14.16.0',
        },
      },
    });
    expect(spies.registerMock).toHaveBeenCalled();
    expect(spies.addSpanProcessorMock).toHaveBeenCalled();
  });

  test('Trim whitespaces in token', () => {
    wrapper.trace(' t_10faa5e13e7844aaa1234   ', 'service-1');
    expect(NodeTracerProvider).toHaveBeenCalledWith({
      resource: {
        attributes: {
          envs: expect.any(String),
          lumigoToken: 't_10faa5e13e7844aaa1234',
          'service.name': 'service-1',
          exporter: 'opentelemetry',
          framework: 'express',
          tracerVersion: '1.0.15',
          runtime: 'nodev14.16.0',
        },
      },
    });
  });

  test('OTLPTraceExporter should have been called with config', () => {
    wrapper.trace(TOKEN, 'service-1', ENDPOINT);
    expect(OTLPTraceExporter).toHaveBeenCalledWith({
      serviceName: 'service-1',
      url: ENDPOINT,
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
    expect(OTLPTraceExporter).not.toHaveBeenCalled();
    process.env.LUMIGO_SWITCH_OFF = undefined;
  });
});
