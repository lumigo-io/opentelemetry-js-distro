import { init, LumigoSdkInitialization } from './distro';
import deasync from 'deasync';

let done = false;
let lumigoSdk: LumigoSdkInitialization | undefined;

init.then((initializedLumigoSdk) => {
  done = true;
  lumigoSdk = initializedLumigoSdk;
});

deasync.loopWhile(() => !done);

export default lumigoSdk;
