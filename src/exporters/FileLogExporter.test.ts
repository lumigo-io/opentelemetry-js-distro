import mockConsole from 'jest-mock-console';
import mock from 'mock-fs';

import { FileLogExporter } from './index';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';

describe('FileLogExporter tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    mock.restore();
  });

  test('should not write anything to file when there is no logs', () => {
    const tmpFile = './test-logs-no-logs.json';

    const exporterUnderTest = new FileLogExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');

    const provider = new LoggerProvider();
    provider.addLogRecordProcessor(new SimpleLogRecordProcessor(exporterUnderTest));

    expect(spyExport).not.toHaveBeenCalled();
  });

  test('should write one span to file', async () => {
    const tmpFile = './test-logs-one-log.json';

    const exporterUnderTest = new FileLogExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');

    const provider = new LoggerProvider();
    provider.addLogRecordProcessor(new SimpleLogRecordProcessor(exporterUnderTest));

    provider.getLogger('default').emit({ attributes: { foo: 'bar' } });

    await provider.shutdown();

    expect(spyExport).toHaveBeenCalledTimes(1);
    const actualLogRecord = spyExport.mock.calls[0][0][0];

    expect(actualLogRecord).toEqual(expect.objectContaining({ attributes: { foo: 'bar' } }));
  });

  test('should write one log record to console.log', async () => {
    const restoreConsole = mockConsole();
    try {
      const exporterUnderTest = new FileLogExporter('console:log');

      const provider = new LoggerProvider();
      provider.addLogRecordProcessor(new SimpleLogRecordProcessor(exporterUnderTest));

      provider.getLogger('default').emit({ attributes: { foo: 'bar' } });

      await provider.shutdown();

      expect(console.log).toHaveBeenCalledTimes(1);
      const actualLogRecord = console.log.mock.calls[0][0];

      expect(JSON.parse(actualLogRecord)).toEqual(
        expect.objectContaining({ attributes: { foo: 'bar' } })
      );
    } finally {
      restoreConsole();
    }
  });

  test('should write one span to console error', async () => {
    const restoreConsole = mockConsole();
    try {
      const exporterUnderTest = new FileLogExporter('console:error');

      const provider = new LoggerProvider();
      provider.addLogRecordProcessor(new SimpleLogRecordProcessor(exporterUnderTest));

      provider.getLogger('default').emit({ attributes: { foo: 'bar' } });

      await provider.shutdown();

      expect(console.error).toHaveBeenCalledTimes(1);
      const actualSpan = console.error.mock.calls[0][0];

      expect(JSON.parse(actualSpan)).toEqual(
        expect.objectContaining({ attributes: { foo: 'bar' } })
      );
    } finally {
      restoreConsole();
    }
  });

  test('should write two spans to file', async () => {
    const tmpFile = './test-spans-two-spans.json';

    const exporterUnderTest = new FileLogExporter(tmpFile);
    const spyExport = jest.spyOn(exporterUnderTest, 'export');

    const provider = new LoggerProvider();
    provider.addLogRecordProcessor(new SimpleLogRecordProcessor(exporterUnderTest));

    provider.getLogger('default').emit({ attributes: { foo: 'bar' } });
    provider.getLogger('default').emit({ attributes: { foo: 'baz' } });

    await provider.shutdown();

    expect(spyExport).toHaveBeenCalledTimes(2);

    const firstLog = spyExport.mock.calls[0][0][0];
    expect(firstLog).toEqual(expect.objectContaining({ attributes: { foo: 'bar' } }));

    const secondLog = spyExport.mock.calls[1][0][0];
    expect(secondLog).toEqual(expect.objectContaining({ attributes: { foo: 'baz' } }));
  });

  test('should log an error when provided an invalid file path', async () => {
    expect(() => {
      new FileLogExporter('\0');
    }).toThrowError(
      "The argument 'path' must be a string or Uint8Array without null bytes. Received '\\x00'"
    );
  });
});
