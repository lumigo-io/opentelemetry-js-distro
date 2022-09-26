require("jest-json");
require("jest-chain");
const {instrumentationsVersionManager} = require("./test/helpers/InstrumentationsVersionManager");
const fs = require("fs");
const semver = require('semver');

const oldEnv = Object.assign({}, process.env);
beforeEach(() => {
  process.env = { ...oldEnv };
});

afterEach(() => {
  process.env = { ...oldEnv };
});


afterAll(() => {
  const versions = instrumentationsVersionManager.getInstrumantaionsVersions();
  Object.keys(versions).forEach((lib) => {
    // updated supported versions file
    const TESTED_VERSIONS_PATH = `./src/instrumentations/${lib}/tested_versions`;
    if (!fs.existsSync(TESTED_VERSIONS_PATH)) {
      fs.mkdirSync(TESTED_VERSIONS_PATH);
    }
    const versionStrings = versions[lib].unsupported
        .map((v) => `!${v}`)
        .concat(versions[lib].supported)
        .sort((v1, v2) => semver.compare(v1.replace('!', ''), v2.replace('!', '')))
        .join('\n');
    fs.writeFileSync(`${TESTED_VERSIONS_PATH}/${lib}`, versionStrings);
  });
});
