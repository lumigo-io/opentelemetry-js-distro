import { init } from "./distro"
import deasync from "deasync";

let lumigoSdkInitResult = null

init.then((result) => {
  lumigoSdkInitResult = result
})

while (lumigoSdkInitResult === null) {
  deasync.sleep(100); // This will block, but allow the event loop to process the Promise resolution
  console.log("Waiting for Lumigo SDK initialization to complete...")
}

console.log("Synchronous Lumigo SDK initialization completed.")