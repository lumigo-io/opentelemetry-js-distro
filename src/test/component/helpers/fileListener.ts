import * as fs from 'fs';
import chokidar from 'chokidar';

let watcher;

export const stopWatching = async () => {
  if (watcher) {
    await watcher.close();
  }
};
export type WatchDirOptions = {
  onAddFileEvent?: (path) => void;
  onChangeFileEvent?: (path) => void;
};
export const watchDir = (spansDir: string, options: WatchDirOptions) => {
  const { onAddFileEvent, onChangeFileEvent } = options;
  if (!fs.existsSync(spansDir)) {
    fs.mkdirSync(spansDir);
  }
  watcher = chokidar.watch(spansDir, {
    ignoreInitial: true,
  });
  watcher
    .on('add', async (path) => {
      await onAddFileEvent(path);
    })
    .on('change', async (path) => {
      await onChangeFileEvent(path);
    });
  return watcher;
};
