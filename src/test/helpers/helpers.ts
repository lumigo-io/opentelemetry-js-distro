import {spawn, exec} from "child_process";
import axios from "axios";

export async function executeNpmScriptWithCallback(
    path,
    onAppReady,
    onData,
    script,
    env,
    shouldFail = false
) {
    let expressApp;
    try {

        exec("pwd", (err,res)=>{
            console.log("IM IN:", res)
        })
        expressApp = spawn(`cd ${path} && npm`, ["run", script], {
            env: { ...process.env, ...env },
            shell: true
        });
        expressApp.stderr.on("data", data => {
            console.log("stderr: ", data.toString());
        });
        expressApp.on("error", error => {
            if (!shouldFail) {
                fail(error);
            }
        });
        expressApp.on("exit", (code, signal) => {
            if (code) console.log(`Process exit with code: ${code}`);
            if (signal) console.log(`Process killed with signal: ${signal}`);
            console.log("Done ✅");
        });
        const port = await new Promise(resolve => {
            let port = undefined;
            expressApp.stdout.on("data", data => {
                onData(data);
                console.log("stdout: ", data.toString());
                const dataStr = data.toString();
                const portRegex = new RegExp(".*(PORT):([0-9]*)", "g");

                const portRegexMatch = portRegex.exec(dataStr);

                if (portRegexMatch && portRegexMatch.length >= 3) {
                    port = portRegexMatch[2];
                    resolve(port);
                }
            });
        });
        await onAppReady(port);
        return expressApp;
    } catch (e) {
        if (!shouldFail) {
            fail(e);
        }
    } finally {
        expressApp.kill(0);
    }
}

export const callContainer = async (port, path, method = "get", body = {}) => {
    const httpResponse = await axios[method](`http://localhost:${port}/${path}`, body);
    expect(httpResponse.status).toBeGreaterThan(199);
    expect(httpResponse.status).toBeLessThan(300);
};