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

    async detect(_config?: ResourceDetectionConfig): Promise<Resource> {
        return new Promise((resolve, reject) => {
            console.log(this._packageRoot)
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { name, version } = require(this._packageRoot + '/../package.json');
            resolve(new Resource({
                lumigoDistroVersion: version
            }));
        });
    }

}