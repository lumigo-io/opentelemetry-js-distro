import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Span, SpanKind } from '@opentelemetry/api';

import fs from 'fs';

jest.mock('fs');

import { FileSpanExporter } from './index';

describe('FileSpanExporter tests', () => {
  let provider: BasicTracerProvider;

  it('should not write anything to file when there is no span', () => {
    const tmpFile = './test-spans.json';

    const exporterUnderTest = new FileSpanExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');

    provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporterUnderTest));

    expect(spyExport).not.toHaveBeenCalled();
  });

  it('should write one span to file', async () => {
    const tmpFile = './test-spans.json';

    const exporterUnderTest = new FileSpanExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');
    provider = new BasicTracerProvider();
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

  it('should write two spans to file', async () => {
    const tmpFile = './test-spans.json';

    const exporterUnderTest = new FileSpanExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');
    provider = new BasicTracerProvider();
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

  test.each`
    fd           | expectedFdatasyncSync | expectedCloseSync
    ${undefined} | ${0}                  | ${0}
    ${null}      | ${0}                  | ${0}
    ${29}        | ${1}                  | ${1}
  `(
    'Call shutdown when this._fd is $fd',
    async ({ fd, expectedFdatasyncSync, expectedCloseSync }) => {
      const tmpFile = './test-spans.json';

      fs.openSync.mockReturnValue(fd);
      const spyFdatasyncSync = jest.spyOn(fs, 'fdatasyncSync').mockReturnValue(undefined);
      const spyCloseSync = jest.spyOn(fs, 'closeSync').mockImplementation((fd) => {
        return fd;
      });

      const exporterUnderTest = new FileSpanExporter(tmpFile);
      const spyShutdown = jest.spyOn(exporterUnderTest, 'shutdown');
      provider = new BasicTracerProvider();
      provider.addSpanProcessor(new SimpleSpanProcessor(exporterUnderTest));

      await exporterUnderTest.shutdown();

      expect(spyShutdown).toHaveBeenCalledTimes(1);
      expect(spyFdatasyncSync).toHaveBeenCalledTimes(expectedFdatasyncSync);
      expect(spyCloseSync).toHaveBeenCalledTimes(expectedCloseSync);
    }
  );
});
