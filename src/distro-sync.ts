import { init } from "./distro"
import deasync from "deasync";

let done = false

init.then(() => {
  done = true
})

deasync.loopWhile(() => !done)