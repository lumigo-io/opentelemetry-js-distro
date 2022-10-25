import axios from "axios";
import {spawn} from "child_process";

export function getAppPort(data: Buffer, resolve, reject) {
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

export function getStartedApp(serverFolder: string, serviceName: string, fileExporterName: string, env_vars = {}) {
    let app = spawn(`cd ${serverFolder} && npm`, ["run", `start:${serviceName}:injected`], {
        env: {
            ...process.env, ...{
                LUMIGO_TRACER_TOKEN: 't_123321',
                LUMIGO_DEBUG_SPANDUMP: fileExporterName,
                OTEL_SERVICE_NAME: serviceName,
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

        // catch ctrl-c
        process.on('SIGINT', (app) => {
            app.kill('SIGINT');
            process.exit();
        });

        // catch kill
        process.on('SIGTERM', (app) => {
            app.kill('SIGINT');
            process.exit();
        });
    }

    return app;
}