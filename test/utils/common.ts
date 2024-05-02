import { readFileSync } from "fs";

export function readDumpFile<T>(dumpFilePath: string): T[] {
  try {
      return readFileSync(dumpFilePath, 'utf-8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  } catch (err) {
      // Might be that we try to read as a new record is being written, and the JSON is still malformed
      return [];
  }
}