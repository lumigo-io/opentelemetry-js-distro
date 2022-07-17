export interface InstrumentationTest {
  resolveSpans: (path: string, resolver) => void;
  onChildProcessData: (data: any, resolve, reject) => void;
  onChildProcessReady: (data: any) => Promise<void>;
  runTests: (spans: any[]) => void;
}
