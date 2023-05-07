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

import { appendFileSync, closeSync, fsyncSync, openSync } from 'fs';
import { realpath, lstat } from 'fs/promises';
import {
  BindOnceFuture,
  ExportResult,
  ExportResultCode,
  hrTimeToMicroseconds,
} from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { logger } from '../logging';

/**
 * This is implementation of {@link SpanExporter} that prints spans to a file.
 * This class can be used for debug purposes. It is not advised to use this
 * exporter in production.
 */

/* eslint-disable no-console */
export class FileSpanExporter implements SpanExporter {
  private readonly file: string;
  private _fd: number;
  private readonly _shutdownOnce: BindOnceFuture<void>;

  constructor(file: string) {
    this.file = file;
    this._fd = openSync(file, 'w');
    this._shutdownOnce = new BindOnceFuture(this._shutdown.bind(this), this);
  }

  /**
   * Export spans.
   * @param spans
   * @param resultCallback
   */
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (!spans || !spans.length) {
      return resultCallback({
        code: ExportResultCode.SUCCESS,
      });
    }

    const spansJson =
      spans.map((span) => JSON.stringify(this._exportInfo(span), undefined, 0)).join('\n') + '\n';

    try {
      appendFileSync(this._fd, spansJson);
    } catch (err) {
      return resultCallback({
        code: ExportResultCode.FAILED,
        error: err,
      });
    }

    return resultCallback({
      code: ExportResultCode.SUCCESS,
    });
  }

  /**
   * converts span info into more readable format
   * @param span
   */
  private _exportInfo(span: ReadableSpan): Object {
    return {
      traceId: span.spanContext().traceId,
      parentId: span.parentSpanId,
      name: span.name,
      id: span.spanContext().spanId,
      kind: span.kind,
      timestamp: hrTimeToMicroseconds(span.startTime),
      duration: hrTimeToMicroseconds(span.duration),
      attributes: span.attributes,
      status: span.status,
      events: span.events,
      resource: span.resource,
    };
  }

  forceFlush(): Promise<void> {
    if (this._shutdownOnce.isCalled) {
      return this._shutdownOnce.promise;
    }
    return this._flushAll();
  }

  /**
   * Shutdown the exporter.
   */
  shutdown(): Promise<void> {
    return this._shutdownOnce.call();
  }

  /**
   * Called by _shutdownOnce with BindOnceFuture
   */
  private async _shutdown(): Promise<void> {
    return await this._flushAll().finally(async () => {
      if (this._fd) {
        /*
         * Do not close block and character devices like `/dev/stdout` or `/dev/stderr`.
         * We need to resolve symbolic links until we get to the actual file, e.g.,
         * `/dev/stdout` -> `/proc/self/fd/1` -> `/dev/pts/0`.
         */
        try {
          const realPath = await realpath(this.file);
          const stats = await lstat(realPath);

          if (stats.isFile()) {
            closeSync(this._fd);
          }
        } catch (err) {
          logger.error(
            `An error occured while shutting down the spandump exporter to file '${this.file}'`,
            err
          );
        }
      }
    });
  }

  private _flushAll = async (): Promise<void> =>
    new Promise((resolve, reject) => {
      try {
        fsyncSync(this._fd);
      } catch (err) {
        logger.error(`An error occured while flushing the spandump to file '${this.file}'`, err);
        reject(err);
        return;
      }

      resolve();
    });
}
