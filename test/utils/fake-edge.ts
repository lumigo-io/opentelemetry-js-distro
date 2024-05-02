import {IResource} from "@opentelemetry/resources";
import { LogRecord } from "@opentelemetry/sdk-logs";
import express, { Express, Request, Response } from 'express';
import { Server } from "http";
import { AddressInfo } from "net";
import pRetry, { FailedAttemptError } from 'p-retry';

export class FakeEdge {
  private app: Express;
  private _logs: LogRecord[] = [];
  private _resources: IResource[] = [];
  private server: Server;
  private baseUrl: string;

  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.app.use('/v1/traces', (req: Request, res: Response) => {
      // Currently not used in any tests, just respond with 200 so spans posted during logging tests will not produce errors
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

  async waitFor(condition: () => boolean, message: string,  timeout = 5000) {
    await pRetry(() => {
      if (condition()) {
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

  get resources() {
    return this._resources;
  }

  reset() {
    this._logs = [];
    this._resources = [];
  }
}