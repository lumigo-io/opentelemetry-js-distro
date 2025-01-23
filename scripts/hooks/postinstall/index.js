#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');

try {
  const deasyncPath = path.dirname(require.resolve('deasync'));
  const deasyncBinPath = path.join(deasyncPath, 'bin');
  const sourcePath = path.join(__dirname, 'deasync-binaries');

  console.log('Copying deasync binaries:', 'from', sourcePath, 'to', deasyncBinPath);
  fs.copySync(sourcePath, deasyncBinPath, { overwrite: false });
} catch (e) {
  console.error('Failed to copy deasync binaries:', e);
  console.warn('@lumigo/opentelemetry/sync endpoint might not work as expected');
}