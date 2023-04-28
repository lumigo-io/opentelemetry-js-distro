import {
  BasicTracerProvider,
  ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { Span, SpanKind, SpanStatusCode, TraceFlags } from '@opentelemetry/api';
import mock from 'mock-fs';

import { FileSpanExporter } from './index';
import { Resource } from '@opentelemetry/resources';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';

describe('FileSpanExporter tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mock.restore();
  });

  test('should not write anything to file when there is no span', () => {
    const tmpFile = './test-spans.json';

    const exporterUnderTest = new FileSpanExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');

    const provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporterUnderTest));

    expect(spyExport).not.toHaveBeenCalled();
  });

  test('should write one span to file', async () => {
    const tmpFile = './test-spans.json';

    const exporterUnderTest = new FileSpanExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');

    const provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporterUnderTest));

    const root: Span = provider.getTracer('default').startSpan('root');
    root.setAttribute('foo', 'bar');
    root.end();

    await provider.shutdown();

    expect(spyExport).toHaveBeenCalledTimes(1);
    const actualSpan = spyExport.mock.calls[0][0][0];

    expect(actualSpan).toEqual(
      expect.objectContaining({
        attributes: { foo: 'bar' },
        _spanContext: expect.any(Object),
        name: 'root',
        kind: SpanKind.INTERNAL,
      })
    );
  });

  test('should write two spans to file', async () => {
    const tmpFile = './test-spans.json';

    const exporterUnderTest = new FileSpanExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');

    const provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporterUnderTest));

    const tracer = provider.getTracer('default');

    const root: Span = tracer.startSpan('root', {
      kind: SpanKind.SERVER,
    });
    root.setAttribute('foo', 'bar');

    const child: Span = tracer.startSpan('child', {
      kind: SpanKind.CLIENT,
    });
    child.setAttribute('fooz', 'baz');
    child.end();

    root.end();

    await provider.shutdown();

    expect(spyExport).toHaveBeenCalledTimes(2);

    // Inverted order because we close child before root
    const actualRootSpan = spyExport.mock.calls[1][0][0];
    expect(actualRootSpan).toEqual(
      expect.objectContaining({
        attributes: { foo: 'bar' },
        _spanContext: expect.any(Object),
        name: 'root',
        kind: SpanKind.SERVER,
      })
    );

    const actualChildSpan = spyExport.mock.calls[0][0][0];
    expect(actualChildSpan).toEqual(
      expect.objectContaining({
        attributes: { fooz: 'baz' },
        _spanContext: expect.any(Object),
        name: 'child',
        kind: SpanKind.CLIENT,
        parentSpanId: root['id'],
      })
    );
  });

  test('should log an error when provided an invalid file path', async () => {
    const { logger } = jest.requireActual('../logging');
    const spyLogger = jest.spyOn(logger, 'error');

    const exporterUnderTest = new FileSpanExporter('\0'); // Invalid Linux file path
    const spyShutdown = jest.spyOn(exporterUnderTest, 'shutdown');

    const provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporterUnderTest));

    const { code, error } = await new Promise<ExportResult>((resolve, _) => {
      exporterUnderTest.export([testSpan], (result) => resolve(result));
    });

    expect(code).toBe(ExportResultCode.FAILED);
    expect(error?.name).toBe('TypeError');

    await exporterUnderTest.shutdown();

    expect(spyShutdown).toHaveBeenCalledTimes(1);
    expect(spyLogger.mock.calls[0][0]).toMatch(
      /An error occured while exporting the spandump to file.*/
    );
  });
});

const testSpan: ReadableSpan = {
  name: 'test',
  kind: SpanKind.INTERNAL,
  spanContext: () => ({
    spanId: '1234',
    traceId: 'abcd-1234',
    traceFlags: TraceFlags.NONE,
  }),
  startTime: [1609504210, 150000000],
  endTime: [1609514210, 150000000],
  status: {
    code: SpanStatusCode.OK,
  },
  attributes: {},
  links: [],
  events: [],
  duration: [10000, 0],
  ended: true,
  resource: Resource.EMPTY,
  instrumentationLibrary: {
    name: 'testScope',
  },
};
