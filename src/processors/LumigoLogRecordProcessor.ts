import { payloadStringify, ScrubContext } from '@lumigo/node-core';
import { Context } from '@opentelemetry/api';
import { LogRecord, LogRecordProcessor } from '@opentelemetry/sdk-logs';

export class LumigoLogRecordProcessor implements LogRecordProcessor {
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onEmit(logRecord: LogRecord, context?: Context): void {
    if (typeof logRecord.body === 'string') {
      try {
        logRecord.body = payloadStringify(JSON.parse(logRecord.body), ScrubContext.DEFAULT);
      } catch (e) {
        // Leave record unaffected
      }
    }
    // @ts-ignore
    logRecord.attributes = JSON.parse(payloadStringify(logRecord.attributes, ScrubContext.DEFAULT));
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
