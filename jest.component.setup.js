import fs from 'fs';
import { instrumentationsVersionManager } from './test/component/helpers/InstrumentationsVersionManager';

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
    if (!fs.existsSync(`${__dirname}/instrumentations/${lib}`)) {
      fs.mkdirSync(`${__dirname}/instrumentations/${lib}`);
    }

    fs.writeFileSync(
      `${__dirname}/instrumentations/${lib}/supported.json`,
      JSON.stringify(
        versions[lib].supported.filter((d) => !versions[lib].unsupported.includes(d)),
        null,
        2
      )
    );

    // updated un supported versions file
    fs.writeFileSync(
      `${__dirname}/instrumentations/${lib}/unsupported.json`,
      JSON.stringify(versions[lib].unsupported, null, 2)
    );
  });
});
