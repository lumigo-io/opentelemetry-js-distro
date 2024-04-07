/*
 * Copyright Lumigo
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { hrTimeToMicroseconds } from '@opentelemetry/core';
import { ReadableLogRecord } from '@opentelemetry/sdk-logs';
import { FileExporter } from './FileExporter';

/**
 * This is implementation of {@link LogExporter} that prints log records to a file.
 * This class can be used for debug purposes. It is not advised to use this
 * exporter in production.
 */
export class FileLogExporter extends FileExporter<ReadableLogRecord> {
  protected exportInfo(logRecord: ReadableLogRecord): Object {
    return {
      timestamp: hrTimeToMicroseconds(logRecord.hrTime),
      traceId: logRecord.spanContext?.traceId,
      spanId: logRecord.spanContext?.spanId,
      traceFlags: logRecord.spanContext?.traceFlags,
      severityText: logRecord.severityText,
      severityNumber: logRecord.severityNumber,
      body: logRecord.body,
      attributes: logRecord.attributes,
    }
  }
}