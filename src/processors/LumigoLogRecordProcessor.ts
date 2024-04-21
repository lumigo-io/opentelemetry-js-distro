import { scrub } from '@lumigo/node-core';
import { Context } from '@opentelemetry/api';
import { LogRecord, LogRecordProcessor } from '@opentelemetry/sdk-logs';

export class LumigoLogRecordProcessor implements LogRecordProcessor {
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onEmit(logRecord: LogRecord, context?: Context): void {
    logRecord.body = scrub(logRecord.body);

    // @ts-ignore
    logRecord.attributes = scrub(logRecord.attributes);
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
