import { ExpressInstrumentation } from 'opentelemetry-instrumentation-express';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {clearIsTraced} from "./wrapper";

const wrapper = require('./wrapper');

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
  const spies = {};
  spies.registerMock = jest.fn();
  spies.addSpanProcessorMock = jest.fn();
  NodeTracerProvider.mockImplementation(() => ({
    register: spies.registerMock,
    addSpanProcessor: spies.addSpanProcessorMock,
  }));
  OTLPTraceExporter.mockImplementation(() => ({}));
  beforeEach(() => {
    clearIsTraced();
    Object.keys(spies).map((x) => spies[x].mockClear());
    OTLPTraceExporter.mockClear();
  });

  test('NodeTracerProvider should have been called with config', async () => {
    await wrapper.trace(TOKEN, 'service-1');
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
          tracerVersion: expect.stringMatching(/\d+\.\d+\.\d+/),
          runtime: expect.stringMatching(/nodev\d+\.\d+\.\d+/),
        },
      },
    });
  });

  test('OTLPTraceExporter should have been called with config', () => {
    wrapper.trace(TOKEN, 'service-1', ENDPOINT);
    expect(OTLPTraceExporter).toHaveBeenCalledWith({
      headers: {
        Authorization: 'LumigoToken t_10faa5e13e7844aaa1234',
      },
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
