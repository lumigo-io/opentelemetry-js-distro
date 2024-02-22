import { ChildProcessWithoutNullStreams, execSync, spawn } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import waitOn from 'wait-on';
import { Span, readSpanDump } from './spans';
import { sleep } from './time';

const WAIT_ON_INITIAL_DELAY = 1_000;
const WAIT_ON_TIMEOUT = 10_000;
const PORT_REGEX = new RegExp('.*([Ll]istening on port )([0-9]*)', 'g');

export class TestApp {

    private app: ChildProcessWithoutNullStreams;
    private closePromise: Promise<void>;
    private cwd: string;
    private envVars: any;
    private exitCode: number | null = null;
    private hasAppExited = false;
    private pid: number | undefined = undefined;
    private portPromise: Promise<Number>;
    private serviceName: string;
    private spanDumpPath: string;
    private readonly showStdout: boolean;

    constructor(
        cwd: string,
        serviceName: string,
        spanDumpPath: string,
        envVars = {},
        showStdout = false
    ) {
        this.cwd = cwd;
        this.envVars = envVars;
        this.serviceName = serviceName;
        this.spanDumpPath = spanDumpPath;
        this.showStdout = showStdout;

        if (existsSync(spanDumpPath)) {
            console.info(`removing previous span dump file ${spanDumpPath}...`)
            unlinkSync(spanDumpPath);
        }

        this.runAppScript();
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

    public runAppScript(): void {
        console.info(`starting test app with span dump file ${this.spanDumpPath}...`);
        this.app = spawn('npm', ['run', 'start'], {
            cwd: this.cwd,
            env: {
                ...process.env,
                ...{
                    OTEL_SERVICE_NAME: this.serviceName,
                    LUMIGO_DEBUG_SPANDUMP: this.spanDumpPath,
                    LUMIGO_DEBUG: String(true),
                },
                ...this.envVars,
            },
            shell: true,
        });
        this.pid = this.app.pid;

        let portResolveFunction: Function;
        this.portPromise = new Promise((resolve) => {
            portResolveFunction = resolve;
        })

        let portPromiseResolved = false;
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

        if (this.showStdout) {
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
                        resolve(readSpanDump(spanDumpPath));
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

    public async getFinalSpans(expectedNumberOfSpans: number | null = null, timeout = 10_000): Promise<Span[]> {
        const spanDumpPath = this.spanDumpPath;

        let spans = readSpanDump(spanDumpPath)

        if (expectedNumberOfSpans) {
            const sleepTime = 500;
            let timeoutRemaining = timeout;
            while (spans.length < expectedNumberOfSpans && timeoutRemaining > 0) {
                await sleep(sleepTime);
                timeoutRemaining -= sleepTime;
                spans = readSpanDump(spanDumpPath);
            }

            if (spans.length < expectedNumberOfSpans) {
                throw new Error(`expected ${expectedNumberOfSpans} spans, but only found ${spans.length} spans`);
            }
        }

        await this.invokeShutdown();
        return spans;
    }

    public async kill(): Promise<number | null> {
        console.info(`killing app with pid '${this.pid}'...`);
        try {
            this.app.kill('SIGKILL');
            await this.closePromise;
        } catch (err) {
            console.warn(err);
        }
        return this.exitCode;
    }
}
