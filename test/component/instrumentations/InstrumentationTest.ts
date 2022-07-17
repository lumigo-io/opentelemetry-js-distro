export interface InstrumentationTest {
  resolveSpans: (path: string, resolver) => void;
  isChildProcessReadyPredicate: (data: any, resolve, reject) => void;
  onChildProcessReady: (data: any) => Promise<void>;
  runTests: (spans: any[]) => void;
}
