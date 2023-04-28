/**
 * This file provides a level of inderection before bootstrapping the Lumigo OpenTelemetry Distro for JS
 * that allows us to check the version of Node.js before anything potentially dangerous (or missing, like
 * `fs/promises` in Node.js).
 * 
 * In `package.json`, we actually point at `distro-init.d.ts` for the types, so that we can use OpenTelemetry
 * types in there, without requiring them in this file.
 *
 * Is the Node.js version is not supported, the initialization logs an error and returns a resolved promise
 * with `undefined` as value; the promise is resolves, instead of rejected, to avoid UnhandledPromiseRejectionWarning
 * or errors affecting processes using unsupported Node.js versions. 
 */
import { minMajor, maxMajor } from './supportedVersions.json';

const trace = (): Promise<any> => {
    const version = process.version;
    try {
        const nodeJsMajorVersion = parseInt(version.match(/v(\d+)\..*/)[1]);

        if (nodeJsMajorVersion < minMajor) {
            console.error(`@lumigo/opentelemetry: Node.js version '${version}' is not supported (minumum supported version: ${minMajor}.x); skipping initialization of the Lumigo OpenTelemetry Distro`);
            /*
             * Return a resolve promise, as opposed to a rejected one, to avoid UnhandledPromiseRejectionWarning
             * processes using unsupported Node.js versions. 
             */
            return Promise.resolve();
        } if (nodeJsMajorVersion > maxMajor) {
            console.error(`@lumigo/opentelemetry: Node.js version '${version}' has not been tested with the Lumigo OpenTelemetry Distro (maximum supported version: ${maxMajor}.x); if you encounter issues, please contact support@lumigo.io`);
        }
    } catch (err) {
        console.error(`@lumigo/opentelemetry: Cannot parse the Node.js version '${version}; skipping initialization of the Lumigo OpenTelemetry Distro`);
        /*
         * Return a resolve promise, as opposed to a rejected one, to avoid UnhandledPromiseRejectionWarning
         * processes using unsupported Node.js versions. 
         */
        return Promise.resolve();
    }

    const { init } = require('./distro-init');
    return init();
};

export const init = trace();
