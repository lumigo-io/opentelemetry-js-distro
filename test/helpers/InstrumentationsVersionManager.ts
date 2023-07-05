export type InstrumentationsVersions = {
    [key: string]: {
        supported: string[]
        unsupported: string[]
    }
}

class InstrumentationsVersionsManager {
    private instrumentationsVersions: InstrumentationsVersions = {};

    addPackageSupportedVersion(packageName: string, version: string) {
        if (!this.instrumentationsVersions[packageName]) this.instrumentationsVersions[packageName] = {supported: [], unsupported: []}
        this.instrumentationsVersions[packageName].supported.push(version);
    }

    addPackageUnsupportedVersion(packageName: string, version: string) {
        if (!this.instrumentationsVersions[packageName]) this.instrumentationsVersions[packageName] = {supported: [], unsupported: []}
        this.instrumentationsVersions[packageName].unsupported.push(version);
    }

    getInstrumentationsVersions(): InstrumentationsVersions {
        return this.instrumentationsVersions;
    }

    clear() {
        this.instrumentationsVersions = {}
    }
}


export const instrumentationsVersionManager = new InstrumentationsVersionsManager()
