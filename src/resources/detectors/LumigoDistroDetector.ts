import { Detector, Resource, ResourceDetectionConfig } from '@opentelemetry/resources';

/**
 * LumigoDistroDetector provides resource attributes documeting which version of the
 * Lumigo Distro for OpenTelemetry is used.
 */
 export class LumigoDistroDetector implements Detector {

    private _packageRoot: string;

    constructor(packageRoot: string) {
        this._packageRoot = packageRoot;
    }

    detect(_config?: ResourceDetectionConfig): Promise<Resource> {
        return Promise.resolve(this._packageRoot)
            .then(packageRoot => {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const { name, version } = require(packageRoot + '/../package.json');
                return { name, version };
            }) //
            .then(packageInfo => {
                return new Resource({
                    lumigoDistroVersion: packageInfo.version
                });
            })
    }

}