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

import fs from 'fs';

import { ExportResult, ExportResultCode, hrTimeToMicroseconds } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { logger } from '../utils';

/**
 * This is implementation of {@link SpanExporter} that prints spans to a file.
 * This class can be used for debug purposes. It is not advised to use this
 * exporter in production.
 */

/* eslint-disable no-console */
export class FileSpanExporter implements SpanExporter {
  private _fd: number;
  private readonly _file: string;
  private _shutdownOnce: BindOnceFuture<void>;

  constructor(file: string) {
    this._file = file;
    this._fd = fs.openSync(file, 'w');

    this.shutdown = this.shutdown.bind(this);
    this._shutdownOnce = new BindOnceFuture(this._shutdown, this);
  }

  /**
   * Export spans.
   * @param spans
   * @param resultCallback
   */
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    return this._sendSpans(spans, resultCallback);
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

  /**
   * Store spans in file
   * @param spans
   * @param done
   */
  private _sendSpans(spans: ReadableSpan[], done?: (result: ExportResult) => void): void {
    let json = '';
    for (const span of spans) {
      json += JSON.stringify(this._exportInfo(span));
      json += '\n';
    }

    fs.appendFile(this._fd, json, async (err) => {
      if (done) {
        if (err) {
          return done({
            code: ExportResultCode.FAILED,
            error: err,
          });
        } else {
          fs.closeSync(this._fd);
          this._fd = fs.openSync(this._file, 'a');
          return done({ code: ExportResultCode.SUCCESS });
        }
      }
    });
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
  private _shutdown(): Promise<void> {
    return Promise.resolve()
      .then(() => {
        return this._flushAll();
      })
      .finally(() => {
        if (this._fd) {
          fs.closeSync(this._fd);
        }
      });
  }

  private _flushAll(): Promise<void> {
    return Promise.resolve().then(() => {
      if (this._fd) {
        try {
          return fs.fdatasyncSync(this._fd);
        } catch (e) {
          logger.error(e);
        }
      }
    });
  }
}

// From https://github.com/open-telemetry/opentelemetry-js/blob/d61f7bee0f7f60fed794d956e122decd0ce6748f/packages/opentelemetry-core/src/utils/callback.ts,
// TODO Replace with the opentelemetry-js SDK version when we upgrade
class BindOnceFuture<R, This = unknown, T extends (this: This, ...args: unknown[]) => R = () => R> {
  private _isCalled = false;
  private _deferred = new Deferred<R>();
  constructor(private _callback: T, private _that: This) {}

  get isCalled() {
    return this._isCalled;
  }

  get promise() {
    return this._deferred.promise;
  }

  call(...args: Parameters<T>): Promise<R> {
    if (!this._isCalled) {
      this._isCalled = true;
      try {
        Promise.resolve(this._callback.call(this._that, ...args)).then(
          (val) => this._deferred.resolve(val),
          (err) => this._deferred.reject(err)
        );
      } catch (err) {
        this._deferred.reject(err);
      }
    }
    return this._deferred.promise;
  }
}

// From https://github.com/open-telemetry/opentelemetry-js/blob/d61f7bee0f7f60fed794d956e122decd0ce6748f/packages/opentelemetry-core/src/utils/promise.ts,
// TODO Replace with the opentelemetry-js SDK version when we upgrade
class Deferred<T> {
  private _promise: Promise<T>;
  private _resolve!: (val: T) => void;
  private _reject!: (error: unknown) => void;
  constructor() {
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  get promise() {
    return this._promise;
  }

  resolve(val: T) {
    this._resolve(val);
  }

  reject(err: unknown) {
    this._reject(err);
  }
}
