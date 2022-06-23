import axios from 'axios';
import {
  ChildProcessWithoutNullStreams,
  spawn,
} from 'child_process';

export const callContainer = async (port: number, path: string, method = 'get', body = {}) => {
  const httpResponse = await axios[method](`http://localhost:${port}/${path}`, body);
  expect(httpResponse.status).toBeGreaterThan(199);
  expect(httpResponse.status).toBeLessThan(300);
};

export async function executeNpmScriptWithCallback(
  path: string,
  onAppReady: (port: number) => Promise<void>,
  onData: (data: string | Buffer | any) => void,
  scriptName: string,
  environmentVariables: any,
  shouldFail = false
) {
  let expressApp: ChildProcessWithoutNullStreams | undefined;
  try {
    expressApp = spawn(`cd ${path} && npm`, ['run', scriptName], {
      env: { ...process.env, ...environmentVariables },
      shell: true,
    });
    expressApp.stderr.on('data', (data) => {
      console.log('stderr: ', data.toString());
    });
    expressApp.on('error', (error) => {
      if (!shouldFail) {
        fail(error);
      }
    });
    expressApp.on('exit', (code, signal) => {
      if (code) console.log(`Process exit with code: ${code}`);
      if (signal) console.log(`Process killed with signal: ${signal}`);
      console.log('Done ✅');
    });
    let port = 0;
    await new Promise<void>((resolve, reject) => {
      if (expressApp) {
        expressApp.stdout.on('data', (data) => {
          onData(data);
          console.log('stdout: ', data.toString());
          if (port === 0) {
            const dataStr = data.toString();
            const portRegex = new RegExp('.*(PORT):([0-9]*)', 'g');

            const portRegexMatch = portRegex.exec(dataStr);

            if (portRegexMatch && portRegexMatch.length >= 3) {
              try {
                port = parseInt(portRegexMatch[2]);
                resolve();
              } catch (exception) {
                reject(exception);
              }
            }
          }
        });
      }
    });
    await onAppReady(port);
    return expressApp;
  } catch (exception) {
    if (!shouldFail) {
      fail(exception);
    }
  } finally {
    if (expressApp) {
      expressApp.kill(0);
    }
  }
}
