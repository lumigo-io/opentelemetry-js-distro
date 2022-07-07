import fs from 'fs';
import { instrumentationsVersionManager } from './test/component/helpers/InstrumentationsVersionManager';

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
    if (!fs.existsSync(`${__dirname}/instrumentations/${lib}/tested_versions`)) {
      fs.mkdirSync(`${__dirname}/instrumentations/${lib}/tested_versions`);
    }
    const versionStrings = versions[lib].unsupported
      .map((v) => `${v}!`)
      .concat(versions[lib].supported)
      .sort((v1, v2) => semver.compare(v1.replace('!', ''), v2.replace('!', '')))
      .toString()
      .replace(/,/g, '\n');
    fs.writeFileSync(`${__dirname}/instrumentations/${lib}/tested_versions/${lib}`, versionStrings);
  });
});
