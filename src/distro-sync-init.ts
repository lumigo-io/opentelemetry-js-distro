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
  This is an intentional use of `module.exports` instead of `export default`.
  using `export default lumigoSdk` would cause the `lumigo` object to have a `default` attribute,
  which is not the desired behavior. See the following examples:

  // With `export default lumigoSdk`:

  const lumigo = require('@lumigo/opentelemetry/sync');
  console.log(lumigo) // { default: tracerProvider }

  // With `module.exports = lumigoSdk`:

  const lumigo = require('@lumigo/opentelemetry/sync');
  console.log(lumigo) // { tracerProvider }
*/
module.exports = lumigoSdk;
