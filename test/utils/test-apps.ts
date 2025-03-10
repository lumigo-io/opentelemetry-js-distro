import { ChildProcessWithoutNullStreams, execSync, spawn } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import waitOn from 'wait-on';
import { Span } from './spans';
import { sleep } from './time';
import { LogRecord } from '@opentelemetry/sdk-logs';
import {readDumpFile} from './common';

const WAIT_ON_INITIAL_DELAY = 1_000;
const WAIT_ON_TIMEOUT = 10_000;
const PORT_REGEX = new RegExp('.*([Ll]istening on port )([0-9]*)', 'g');

type TestAppOptions = {
    spanDumpPath?: string,
    logDumpPath?: string,
    env?: Record<string, string>,
    showStdout?: boolean
    startupScript?: string
}

export class TestApp {
    private app: ChildProcessWithoutNullStreams;
    private closePromise: Promise<void>;
    private exitCode: number | null = null;
    private hasAppExited = false;
    private pid: number | undefined = undefined;
    private portPromise: Promise<Number>;

    constructor(
        private readonly cwd: string,
        private readonly serviceName: string,
        private readonly options: TestAppOptions = {
            env: {},
            showStdout: false,
            startupScript: 'start',
        }
    ) {
        const { logDumpPath, spanDumpPath, startupScript = "start" } = options;
        if (spanDumpPath && existsSync(spanDumpPath)) {
            console.info(`removing previous span dump file ${spanDumpPath}...`)
            unlinkSync(spanDumpPath);
        }

        if (logDumpPath && existsSync(logDumpPath)) {
            console.info(`removing previous log dump file ${logDumpPath}...`)
            unlinkSync(logDumpPath);
        }

        this.runAppScript(startupScript);
    }

    public static runAuxiliaryScript(scriptName: string, cwd: string, envVars = {}): void {
        console.info(`running ${scriptName} for test app in '${cwd}'...`)
        execSync(`npm run ${scriptName}`, {
            cwd,
            env: {
                ...process.env,
                ...envVars,
            },
        });
    };

    private runAppScript(startupScript): void {
        const { spanDumpPath, logDumpPath, showStdout, env: envVars } = this.options;

        console.info(`starting test app with span dump file ${spanDumpPath}, log dump file ${logDumpPath}...`);
        this.app = spawn('npm', ['run', startupScript], {
            cwd: this.cwd,
            env: {
                ...process.env,
                ...{
                    OTEL_SERVICE_NAME: this.serviceName,
                    LUMIGO_DEBUG_SPANDUMP: spanDumpPath,
                    LUMIGO_DEBUG_LOGDUMP: logDumpPath,
                    LUMIGO_DEBUG: String(true),
                },
                ...envVars,
            },
            shell: true,
        });
        this.pid = this.app.pid;

        let portResolveFunction: Function;
        this.portPromise = new Promise((resolve) => {
            portResolveFunction = resolve;
        })

        let portPromiseResolved = false;
        this.app.stdout.on('data', (data) => {
            const dataStr = data.toString();

            if (!portPromiseResolved) {
                const portRegexMatch = PORT_REGEX.exec(dataStr);

                if (portRegexMatch && portRegexMatch.length >= 3) {
                    portPromiseResolved = true;
                    portResolveFunction(parseInt(portRegexMatch[2]));
                }
            }
            console.info('spawn data stdout: ', dataStr);
        });
        this.app.stderr.on('data', (data) => {
            const dataStr = data.toString();

            if (!portPromiseResolved) {
                const portRegexMatch = PORT_REGEX.exec(dataStr);

                if (portRegexMatch && portRegexMatch.length >= 3) {
                    portPromiseResolved = true;
                    portResolveFunction(parseInt(portRegexMatch[2]));
                }
            }

            console.info('spawn data stderr: ', dataStr);
        });

        if (showStdout) {
            this.app.stdout.on('data', (data) => {
                console.info(`[${this.serviceName}] `, data.toString());
            });
        }

        let closeResolveFunction: Function;
        let closeRejectFunction: Function;
        this.closePromise = new Promise((resolve, reject) => {
            closeResolveFunction = resolve;
            closeRejectFunction = reject;
        });

        this.app.on('error', (error) => {
            closeRejectFunction(error);
        });

        this.app.on('exit', function (exitCode, signal) {
            if (this.hasAppExited) {
                return;
            }
            this.hasAppExited = true;
            this.exitCode = exitCode;

            switch (signal) {
                case 'SIGKILL':
                case 'SIGTERM':
                    const appExitMessage = `app with pid '${this.pid}' exited with signal '${signal}' and exit code '${exitCode}'`;
                    console.info(appExitMessage);
                    break;
                default:
                    const appExitWarning = `app with pid '${this.pid}' exited unexpectedly with signal '${signal}':
                    *** if the app already exited, this is actually expected ***`;
                    console.warn(appExitWarning);
                    break;
            }
            // even if the test app exited unexpectedly, we still want to resolve the close promise,
            // so that the test can continue - it's reasonable to assume that the tests are written
            // well enough to fail regardless of the app's exit code
            closeResolveFunction();

            portPromiseResolved = true;
            portResolveFunction(-1);
        });
    };

    public async port(): Promise<Number> {
        const port = Number(await this.portPromise);
        if (port < 0 || this.hasAppExited) {
            throw new Error(`port unavailable for test app with pid '${this.pid}'`);
        }
        return port;
    }

    public async waitUntilReady(): Promise<void> {
        await this.port();
    }

    public async invokeGetPath(path: string): Promise<void> {
        const port = await this.port()

        const url = `http-get://localhost:${port}/${path.replace(/^\/+/, '')}`;

        return new Promise<void>((resolve, reject) => {
            console.info(`invoking url: ${url} ...`);
            waitOn(
                {
                    resources: [url],
                    delay: WAIT_ON_INITIAL_DELAY,
                    timeout: WAIT_ON_TIMEOUT,
                    simultaneous: 1,
                    log: true,
                    validateStatus: function (status: number) {
                        console.info(`received status: ${status}`);
                        return status >= 200 && status < 300; // default if not provided
                    },
                },
                async function (err: Error) {
                    if (err) {
                        return reject(err)
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    public async invokeGetPathAndRetrieveSpanDump(path: string): Promise<Span[]> {
        const port = await this.port()

        const url = `http-get://localhost:${port}/${path.replace(/^\/+/, '')}`;
        const spanDumpPath = this.spanDumpPath;

        return new Promise<Span[]>((resolve, reject) => {
            console.info(`invoking url: ${url} and waiting for span dump...`);
            waitOn(
                {
                    resources: [url],
                    delay: WAIT_ON_INITIAL_DELAY,
                    timeout: WAIT_ON_TIMEOUT,
                    simultaneous: 1,
                    log: true,
                    validateStatus: function (status: number) {
                        console.info(`received status: ${status}`);
                        return status >= 200 && status < 300; // default if not provided
                    },
                },
                async function (err: Error) {
                    if (err) {
                        return reject(err)
                    } else {
                        resolve(readDumpFile(spanDumpPath));
                    }
                }
            );
        });
    }

    /**
     * test apps must implement a /quit endpoint that shuts down all servers and exits the process
     * @returns a promise that resolves when the app has returned 200 on the shutdown signal
     */
    public async invokeShutdown(): Promise<void> {
        const port = await this.port()

        const url = `http-get://localhost:${port}/quit`;

        return new Promise<void>((resolve, reject) => {
            console.info(`invoking shutdown url for app wth pid ${this.pid}: ${url} ...`);
            waitOn(
                {
                    resources: [url],
                    delay: WAIT_ON_INITIAL_DELAY,
                    timeout: WAIT_ON_TIMEOUT,
                    simultaneous: 1,
                    log: true,
                    validateStatus: function (status: number) {
                        console.info(`received status: ${status}`);
                        return status >= 200 && status < 300; // default if not provided
                    },
                },
                async function (err: Error) {
                    if (err) {
                        return reject(err)
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    public async getFinalSpans(expectedNumberOfSpans?: number, timeout = 10_000): Promise<Span[]> {
        const { spanDumpPath } = this.options;

        if (!spanDumpPath) {
            throw new Error('spanDumpPath was not provided in the TestApp options');
        }

        return await this.getFinalRecords<Span>(spanDumpPath, expectedNumberOfSpans, timeout);
    }

    public async getFinalLogs(expectedNumberOfLogs?: number, timeout = 10_000): Promise<LogRecord[]> {
        const { logDumpPath } = this.options;

        if (!logDumpPath) {
            throw new Error('logDumpPath was not provided in the TestApp options');
        }

        return await this.getFinalRecords<LogRecord>(logDumpPath, expectedNumberOfLogs, timeout);
    }

    public async getFinalRecords<T>(dumpFilePath: string, expectedNumberOfRecords?: number, timeout = 10_000): Promise<T[]> {
        let records: T[] = readDumpFile<T>(dumpFilePath)

        if (expectedNumberOfRecords) {
            const sleepTime = 500;
            let timeoutRemaining = timeout;
            while (records.length < expectedNumberOfRecords && timeoutRemaining > 0) {
                await sleep(sleepTime);
                timeoutRemaining -= sleepTime;
                records = readDumpFile<T>(dumpFilePath);
            }

            if (records.length < expectedNumberOfRecords) {
                throw new Error(`expected ${expectedNumberOfRecords} records, but only found ${records.length}`);
            }
        }

        await this.invokeShutdown();

        return records;
    }

    public async kill(): Promise<number | null> {
        console.info(`killing app with pid '${this.pid}'...`);
        try {
            // Avoids PIPEWRAP open handle error when killing the test app
            this.app.stdout.destroy()
            this.app.stderr.destroy()

            this.app.kill('SIGKILL');
            await this.closePromise;
        } catch (err) {
            console.warn(err);
        }
        return this.exitCode;
    }
}
