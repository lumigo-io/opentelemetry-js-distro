import { scrub } from '@lumigo/node-core';
import type { Context } from '@opentelemetry/api';
import type { LogRecord, LogRecordProcessor } from '@opentelemetry/sdk-logs';

export class LumigoLogRecordProcessor implements LogRecordProcessor {
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  onEmit(logRecord: LogRecord, context?: Context): void {
    logRecord.body = scrub(logRecord.body);

    // @ts-ignore
    logRecord.attributes = scrub(logRecord.attributes);
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
