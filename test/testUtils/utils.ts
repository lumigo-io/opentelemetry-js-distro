import axios from "axios";

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