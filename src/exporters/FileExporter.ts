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
import { BindOnceFuture, ExportResult, ExportResultCode } from '@opentelemetry/core';
import { logger } from '../logging';

/**
 * This is implementation of {@link LogExporter} that prints log records to a file.
 * This class can be used for debug purposes. It is not advised to use this
 * exporter in production.
 */

const PRINT_TO_CONSOLE_LOG = 'console:log';
const PRINT_TO_CONSOLE_ERROR = 'console:error';

export interface Exporter<T> {
  export(record: T[], resultCallback: (result: ExportResult) => void): void;
  shutdown(): Promise<void>;
}

/* eslint-disable no-console */
export abstract class FileExporter<T> implements Exporter<T> {
  private readonly file: string;
  private _fd: number;
  private readonly _shutdownOnce: BindOnceFuture<void>;

  constructor(file: string) {
    this.file = file;

    if (![PRINT_TO_CONSOLE_LOG, PRINT_TO_CONSOLE_ERROR].includes(file)) {
      this._fd = openSync(file, 'w');
      this._shutdownOnce = new BindOnceFuture(this._shutdown.bind(this), this);
    }
  }

  /**
   * Export log records.
   * @param records
   * @param resultCallback
   */
  export(records: T[], resultCallback: (result: ExportResult) => void): void {
    if (!records?.length) {
      return resultCallback({
        code: ExportResultCode.SUCCESS,
      });
    }

    const logsRecordsJson =
      records.map((record) => JSON.stringify(this.exportInfo(record), undefined, 0)).join('\n') +
      '\n';

    try {
      if (this._fd) {
        appendFileSync(this._fd, logsRecordsJson);
      } else if (this.file === PRINT_TO_CONSOLE_LOG) {
        console.log(logsRecordsJson);
      } else if (this.file === PRINT_TO_CONSOLE_ERROR) {
        console.error(logsRecordsJson);
      }
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
   * converts records info into a more readable format
   * @param record
   */
  protected abstract exportInfo(record: T): Object;

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
    return this._shutdownOnce?.call();
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
            `An error occurred while shutting down the logdump exporter to file '${this.file}'`,
            err
          );
        }
      }
    });
  }

  private _flushAll = async (): Promise<void> =>
    new Promise((resolve, reject) => {
      if (this._fd) {
        try {
          fsyncSync(this._fd);
        } catch (err) {
          logger.error(`An error occurred while flushing the logdump to file '${this.file}'`, err);
          reject(err);
          return;
        }
      }

      resolve();
    });
}
