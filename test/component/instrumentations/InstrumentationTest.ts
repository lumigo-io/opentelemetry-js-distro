export interface InstrumentationTest {
  spansReadyCondition: (lines: string[], resolve) => void;
  isChildProcessReadyPredicate: (data: any, resolve, reject) => void;
  onChildProcessReady: (data: any) => Promise<void>;
  runTests: (spans: any[]) => void;
}
