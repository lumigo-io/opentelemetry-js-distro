import chokidar from 'chokidar';
import * as fs from 'fs';

let watcher;

export const stopWatching = async () => {
  if (watcher) {
    await watcher.close();
  }
};

export type WatchDirOptions = {
  onAddFileEvent?: (path: string) => void,
  onChangeFileEvent?: (path: string) => void,
};

export const watchDir = (spansDir: string, options: WatchDirOptions) => {
  const { onAddFileEvent, onChangeFileEvent } = options;
  if (!fs.existsSync(spansDir)) {
    fs.mkdirSync(spansDir);
  }
  watcher = chokidar.watch(spansDir, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 20,
      pollInterval: 10,
    },
  });
  watcher
    .on('add', async (path: string) => {
      if (onAddFileEvent) {
        onAddFileEvent(path);
      }
    })
    .on('change', async (path: string) => {
      if (onChangeFileEvent) {
        onChangeFileEvent(path);
      }
    });
  return watcher;
};
