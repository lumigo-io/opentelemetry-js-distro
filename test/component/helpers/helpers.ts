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

export async function waitForChildProcess(
  path: string,
  onAppReady: (data: any) => Promise<void>,
  isChildProcessReadyPredicate: (data: string | Buffer | any, resolve, reject) => void,
  scriptName: string,
  environmentVariables: any,
  timeout: number,
  shouldFail = false
) {
  let timeoutHandle: NodeJS.Timeout;
  let nodeChildApp: ChildProcessWithoutNullStreams | undefined;
  try {
    nodeChildApp = spawn(`cd ${path} && npm`, ['run', scriptName], {
      env: { ...process.env, ...environmentVariables },
      shell: true,
    });
    nodeChildApp.stderr.on('data', (data) => {
      console.log('stderr: ', data.toString());
    });
    nodeChildApp.on('error', (error) => {
      if (!shouldFail) {
        fail(error);
      }
    });
    const data = await new Promise<void>((resolve, reject) => {
      nodeChildApp.stdout.on('data', (data) => {
        isChildProcessReadyPredicate(data, resolve, reject);
      });
    });
    const timeoutPromise = new Promise((resolve, reject) => {
      timeoutHandle = setTimeout(() => reject(), timeout);
    });
    await Promise.race([onAppReady(data),timeoutPromise]).then(result => {
      clearTimeout(timeoutHandle)
      return result;
    });
    return nodeChildApp;
  } catch (exception) {
    if (!shouldFail) {
      fail(exception);
    }
  } finally {
    if (nodeChildApp) {
      nodeChildApp.kill(0);
    }
  }
}
