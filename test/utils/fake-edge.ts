import {IResource} from "@opentelemetry/resources";
import { LogRecord } from "@opentelemetry/sdk-logs";
import type { Span } from '@opentelemetry/api';
import express, { Express, Request, Response } from 'express';
import { Server } from "http";
import { AddressInfo } from "net";
import pRetry, { FailedAttemptError } from 'p-retry';

type FakeEdgeState = {
  logs: LogRecord[];
  spans: Span[];
  resources: IResource[];
}

export class FakeEdge {
  private app: Express;
  private _logs: LogRecord[] = [];
  private _spans: Span[] = [];
  private _resources: IResource[] = [];
  private server: Server;
  private baseUrl: string;

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.app.use('/v1/traces', (req: Request, res: Response) => {
      try {
        const scopeSpans = req.body.resourceSpans.flatMap(rl => rl.scopeSpans.flatMap(sl => sl.scopeSpans))
        console.log(`Received ${scopeSpans.length} logs in edge`);
        this.spans.push(...scopeSpans)

        const resources = req.body.resourceSpans.map(rl => rl.resource)
        console.log(`Received ${resources.length} resources in edge`);
        this._resources.push(...resources)
      } catch (e) {
        console.error('Error parsing spans in edge: ', e);
        return res.sendStatus(500);
      }
      res.sendStatus(200);
    });
    this.app.use('/v1/logs', (req: Request, res: Response) => {
      try {
        const logRecords = req.body.resourceLogs.flatMap(rl => rl.scopeLogs.flatMap(sl => sl.logRecords))
        console.log(`Received ${logRecords.length} logs in edge`);
        this._logs.push(...logRecords)

        const resources = req.body.resourceLogs.map(rl => rl.resource)
        console.log(`Received ${resources.length} resources in edge`);
        this._resources.push(...resources)

      } catch (e) {
        console.error('Error parsing logs in edge: ', e);
        return res.sendStatus(500);
      }
      res.sendStatus(200);
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(0, () => {
        this.server.on('error', (err: any) => reject(err));

        const addressInfo = this.server.address() as AddressInfo
        this.baseUrl = `localhost:${addressInfo.port}`;

        console.log(`Edge is running on address ${this.baseUrl}`);
        resolve(this.baseUrl);
      });
    });
  }

  get logsUrl() {
    return `http://${this.baseUrl}/v1/logs`;
  }

  get tracesUrl() {
    return `http://${this.baseUrl}/v1/traces`;
  }

  async waitFor(condition: (edgeFakeState: FakeEdgeState) => boolean, message: string,  timeout = 5000) {
    await pRetry(() => {
      if (condition({ logs: this.logs, spans: this.spans, resources: this.resources })) {
        return Promise.resolve();
      } else {
        return Promise.reject(new Error('Condition not met'));
      }
    }, { maxTimeout: timeout, onFailedAttempt: () => console.log(message)})
  }

  stop() {
    return new Promise((resolve, reject) => {
      this.server.close((err: unknown) => {
        if (err) {
          reject(err);
        } else {
          resolve(undefined);
        }
      });
    });
  }

  get logs() {
    return this._logs;
  }

  get spans() {
    return this._spans;
  }

  get resources() {
    return this._resources;
  }

  reset() {
    this._logs = [];
    this._spans = [];
    this._resources = [];
  }
}