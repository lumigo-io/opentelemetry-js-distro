export type InstrumentationsVersions = {
    [key: string]: {
        supported: string[]
        unsupported: string[]
    }
}

class InstrumentationsVersionsManager {
    private instrumentationsVersions: InstrumentationsVersions = {};

    addPackageSupportedVersion(packageName: string, version: string) {
        if (!this.instrumentationsVersions[packageName]) {
            this.instrumentationsVersions[packageName] = {supported: [version], unsupported: []};
        } else {
            // only add version to supported if it was not added anywhere else before
            if (!this.instrumentationsVersions[packageName].unsupported.includes(version) &&
                !this.instrumentationsVersions[packageName].supported.includes(version)) {
                this.instrumentationsVersions[packageName].supported.push(version);
            }
        }
    }

    addPackageUnsupportedVersion(packageName: string, version: string) {
        if (!this.instrumentationsVersions[packageName]) {
            this.instrumentationsVersions[packageName] = {supported: [], unsupported: [version]};
        } else {
            if (!this.instrumentationsVersions[packageName].unsupported.includes(version)) {
                this.instrumentationsVersions[packageName].unsupported.push(version);
            }
            // remove version from supported if it was added before
            this.instrumentationsVersions[packageName].supported = this.instrumentationsVersions[packageName].supported.filter(
                (supportedVersion) => supportedVersion !== version
            );
        }
    }

    getInstrumentationsVersions(): InstrumentationsVersions {
        return this.instrumentationsVersions;
    }

    clear() {
        this.instrumentationsVersions = {}
    }
}

export const instrumentationsVersionManager = new InstrumentationsVersionsManager()
