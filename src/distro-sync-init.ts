import { init, LumigoSdkInitialization } from './distro';
import deasync from 'deasync';

let done = false;
let lumigoSdk: LumigoSdkInitialization | undefined;

init
  .then((initializedLumigoSdk) => {
    lumigoSdk = initializedLumigoSdk;
  })
  .catch((err) => {
    console.error(`Lumigo JS distro synchronous bootstrap failed: ${err}`);
  })
  .finally(() => {
    done = true;
  });

deasync.loopWhile(() => !done);

/*
  The `export =` syntax makes sure that using the sync endpoint from both TS and JS will return the same object structure:

    // TS
    import lumigoSdk from '@lumigo/opentelemetry/sync';

    // JS
    const lumigoSdk = require('@lumigo/opentelemetry/sync');

  Using `export default lumigoSdk` would have made the JS usage look like this:

    // JS code generated by TS would have a `default` property for interoperability
    const { default: lumigoSdk } = require('@lumigo/opentelemetry/sync');
 */
export = lumigoSdk;
