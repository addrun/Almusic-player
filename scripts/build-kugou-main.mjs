import { build } from 'electron-vite';

// This directory compatibility patch changes only the Electron main process.
await build({ configFile: 'scripts/electron.kugou-main.config.mjs', ignoreConfigWarning: true });
