import { LogRecord } from '@opentelemetry/sdk-logs';
import { LumigoLogRecordProcessor } from './LumigoLogRecordProcessor';
import { LogAttributes, LogBody } from '@opentelemetry/api-logs';

import 'jest-json';

describe('LumigoLogRecordProcessor', () => {
  it('does not fail on missing attributes', () => {
    const logRecord: LogRecord = logRecordWith('some body', undefined);

    // @ts-ignore
    delete logRecord.attributes;

    const processor = new LumigoLogRecordProcessor();
    processor.onEmit(logRecord);

    expect(logRecord.body).toEqual('some body');
    expect(logRecord.attributes).toBeUndefined();
  });

  it('scrubs the log body and attributes when those are objects', () => {
    jest.isolateModules(() => {
      process.env.LUMIGO_SECRET_MASKING_REGEX = '[".*sekret.*"]';
      const { LumigoLogRecordProcessor } = jest.requireActual('./LumigoLogRecordProcessor');

      const logRecord: LogRecord = logRecordWith(
        { 'sekret-body': '123' },
        { 'sekret-attr': '456' }
      );

      const processor = new LumigoLogRecordProcessor();
      processor.onEmit(logRecord);

      expect(logRecord.body).toMatchObject({ 'sekret-body': '****' });
      expect(logRecord.attributes).toMatchObject({ 'sekret-attr': '****' });
    });
  });

  const logRecordWith = (body: LogBody, attributes: LogAttributes = {}) =>
    // @ts-ignore
    new LogRecord({ logRecordLimits: {} }, { name: 'test', version: 'v1' }, { body, attributes });
});
