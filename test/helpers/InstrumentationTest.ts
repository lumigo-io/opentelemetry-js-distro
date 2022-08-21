import {ChildProcess} from "child_process";

export interface InstrumentationTest {
  spansReadyCondition: (lines: string[], resolve) => void;
  isChildProcessReadyPredicate: (data: any, nodeChildApp: ChildProcess, resolve, reject) => void;
  onChildProcessReady: (data: any, nodeChildApp: ChildProcess) => Promise<void>;
  runTests: (spans: any[]) => void;
  getName:() => string;
  getEnvVars: ()=> {[key: string]: string}
}
