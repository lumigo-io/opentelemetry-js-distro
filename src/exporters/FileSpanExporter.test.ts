import { Span, SpanKind } from '@opentelemetry/api';
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import mockConsole from 'jest-mock-console';
import mock from 'mock-fs';

import { FileSpanExporter } from './index';

describe('FileSpanExporter tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mock.restore();
  });

  test('should not write anything to file when there is no span', () => {
    const tmpFile = './test-spans-no-spans.json';

    const exporterUnderTest = new FileSpanExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');

    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporterUnderTest)],
    });

    expect(spyExport).not.toHaveBeenCalled();
  });

  test('should write one span to file', async () => {
    const tmpFile = './test-spans-one-span.json';

    const exporterUnderTest = new FileSpanExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');

    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporterUnderTest)],
    });

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

  test('should write one span to console.log', async () => {
    const restoreConsole = mockConsole();
    try {
      const exporterUnderTest = new FileSpanExporter('console:log');

      const provider = new BasicTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(exporterUnderTest)],
      });

      const root: Span = provider.getTracer('default').startSpan('root');
      root.setAttribute('foo', 'bar');
      root.end();

      await provider.shutdown();

      expect(console.log).toHaveBeenCalledTimes(1);
      const actualSpan = console.log.mock.calls[0][0];

      expect(JSON.parse(actualSpan)).toEqual(
        expect.objectContaining({
          name: 'root',
          attributes: { foo: 'bar' },
          kind: SpanKind.INTERNAL,
        })
      );
    } finally {
      restoreConsole();
    }
  });

  test('should write one span to console error', async () => {
    const restoreConsole = mockConsole();
    try {
      const exporterUnderTest = new FileSpanExporter('console:error');

      const provider = new BasicTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(exporterUnderTest)],
      });

      const root: Span = provider.getTracer('default').startSpan('root');
      root.setAttribute('foo', 'bar');
      root.end();

      await provider.shutdown();

      expect(console.error).toHaveBeenCalledTimes(1);
      const actualSpan = console.error.mock.calls[0][0];

      expect(JSON.parse(actualSpan)).toEqual(
        expect.objectContaining({
          name: 'root',
          attributes: { foo: 'bar' },
          kind: SpanKind.INTERNAL,
        })
      );
    } finally {
      restoreConsole();
    }
  });

  test('should write two spans to file', async () => {
    const tmpFile = './test-spans-two-spans.json';

    const exporterUnderTest = new FileSpanExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');

    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporterUnderTest)],
    });

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
    expect(actualRootSpan).toMatchObject({
      attributes: { foo: 'bar' },
      _spanContext: expect.any(Object),
      name: 'root',
      kind: SpanKind.SERVER,
    });

    const actualChildSpan = spyExport.mock.calls[0][0][0];
    expect(actualChildSpan).toMatchObject({
      attributes: { fooz: 'baz' },
      _spanContext: expect.any(Object),
      name: 'child',
      kind: SpanKind.CLIENT,
    });
  });

  test('should log an error when provided an invalid file path', async () => {
    expect(() => {
      new FileSpanExporter('\0');
    }).toThrowError(
      "The argument 'path' must be a string, Uint8Array, or URL without null bytes. Received '\\x00'"
    );
  });
});
