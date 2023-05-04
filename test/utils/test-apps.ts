import { existsSync, unlinkSync } from 'fs';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import kill from 'tree-kill';
import waitOn from 'wait-on';
import { readSpanDump, Span } from './spans';

const WAIT_ON_INITIAL_DELAY = 1_000;
const WAIT_ON_TIMEOUT = 10_000;

export async function startTestApp(cwd: string, serviceName: string, spanDumpPath: string, env_vars = {}): Promise<{app: ChildProcessWithoutNullStreams, port: number}> {
    if (existsSync(spanDumpPath)) {
        unlinkSync(spanDumpPath);
    }

    const app = spawn('npm', ['run', 'start'], {
        cwd,
        env: {
            ...process.env, ...{
                OTEL_SERVICE_NAME: serviceName,
                LUMIGO_DEBUG_SPANDUMP: spanDumpPath,
                LUMIGO_DEBUG: String(true),
                ...env_vars
            }
        },
        shell: true,
    });

    app.stderr.on('data', (data) => {
        console.info('spawn data stderr: ', data.toString());
    });
    app.on('error', (error) => {
        console.error('spawn stderr: ', error);
    });

    app.on('exit', function (_, signal) {
        const pid = `${this.pid ? this.pid : undefined}`;
        //we kill the app with 'SIGHUP' in the afterEach, we want to throw error only when it's real app issue
        if (signal && signal !== 'SIGHUP') {
            throw new Error(`app with pid: ${pid} exit unexpectedly!`);
        }
    });

    // catch ctrl-c
    process.once('SIGINT', (_) => {
        kill(app.pid!, 'SIGINT');
        process.exit();
    });

    // catch kill
    process.once('SIGTERM', (_) => {
        kill(app.pid!, 'SIGTERM');
        process.exit();
    });

    const port = await new Promise<number>((resolve, reject) => {
        app.stdout.on('data', (data) => {
            try {
                const port = getAppPort(data);
                if (port) {
                    resolve(port);
                }
            } catch (err) {
                reject(err);
            }
        });
    });
    
    return {
        app,
        port,
    };
}

function getAppPort(data: Buffer): number | undefined{
    const dataStr = data.toString();
    const portRegex = new RegExp('.*(Listening on port )([0-9]*)', 'g');

    const portRegexMatch = portRegex.exec(dataStr);

    if (portRegexMatch && portRegexMatch.length >= 3) {
        return parseInt(portRegexMatch[2]);
    }
}

// TODO Rewrite without wait-on
export async function invokeHttpAndGetSpanDump(url: string, spanDumpPath: string): Promise<Span[]> {
    return new Promise<Span[]>((resolve, reject) => {
        waitOn(
            {
                resources: [url],
                delay: WAIT_ON_INITIAL_DELAY,
                timeout: WAIT_ON_TIMEOUT,
                simultaneous: 1,
                log: true,
                validateStatus: function (status: number) {
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
