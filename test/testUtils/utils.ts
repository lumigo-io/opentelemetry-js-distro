import { existsSync, readFileSync, unlinkSync } from 'fs';
import { dirname } from 'path';
import axios from 'axios';
import { spawn } from 'child_process';
import kill from 'tree-kill';

function getAppPort(data: Buffer, resolve, reject) {
    const dataStr = data.toString();
    const portRegex = new RegExp('.*(Listening on port )([0-9]*)', 'g');

    const portRegexMatch = portRegex.exec(dataStr);

    if (portRegexMatch && portRegexMatch.length >= 3) {
        try {
            const port = parseInt(portRegexMatch[2]);
            resolve(port);
        } catch (exception) {
            reject(exception);
        }
    }
}

export const callContainer = async (port: number, path: string, method = 'get', body = {}) => {
    const httpResponse = await axios[method](`http://localhost:${port}/${path}`, body);
    expect(httpResponse.status).toBeGreaterThan(199);
    expect(httpResponse.status).toBeLessThan(300);
};

export function readSpans(filePath) {
    return readFileSync(filePath, 'utf-8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

export async function startTestApp(cwd: string, serviceName: string, spanDumpPath: string, env_vars = {}) {
    if (existsSync(spanDumpPath)) {
        unlinkSync(spanDumpPath);
    }

    let app = spawn('npm', ['run', `start:${serviceName}:injected`], {
        cwd,
        env: {
            ...process.env, ...{
                OTEL_SERVICE_NAME: serviceName,
                LUMIGO_DEBUG_SPANDUMP: spanDumpPath,
                LUMIGO_DEBUG: true,
                ...env_vars
            }
        },
        shell: true
    });

    if (app) {
        app.stderr.on('data', (data) => {
            console.info('spawn data stderr: ', data.toString());
        });
        app.on('error', (error) => {
            console.error('spawn stderr: ', error);
        });

        app.on('exit', function (code, signal) {
            const pid = `${this.pid ? this.pid : undefined}`;
            //we kill the app with 'SIGHUP' in the afterEach, we want to throw error only when it's real app issue
            if (signal && signal !== 'SIGHUP') {
                throw new Error(`app with pid: ${pid} exit unexpectedly!`);
            }
        });

        // catch ctrl-c
        process.once('SIGINT', (app) => {
            kill(app.pid, 'SIGINT');
            process.exit();
        });

        // catch kill
        process.once('SIGTERM', (app) => {
            kill(app.pid, 'SIGTERM');
            process.exit();
        });
    }

    const port = await new Promise((resolve, reject) => {
        app.stdout.on('data', (data) => {
            getAppPort(data, resolve, reject);
        });
    });
    
    return {
        app,
        port,
    };
}

export function versionsToTest(instrumentationName, packageName) {
    return readFileSync(`${dirname(dirname(__dirname))}/src/instrumentations/${instrumentationName}/tested_versions/${packageName}`)
        .toString()
        .split('\n')
        .filter(Boolean)
        .filter(version => !version.startsWith('!'));
}