import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { app } from 'electron';

// Run before modules that create electron-store instances or Chromium sessions.
// A rename must not move, copy, or discard an existing account/profile directory.
app.setName('Almusic');
const appData = app.getPath('appData');
const currentDirectory = join(appData, 'Almusic');
const legacyDirectory = join(appData, 'ZephyrusPlayer');
const isDirectory = (directory: string): boolean =>
  existsSync(directory) && statSync(directory).isDirectory();

if (isDirectory(currentDirectory)) {
  app.setPath('userData', currentDirectory);
} else if (isDirectory(legacyDirectory)) {
  app.setPath('userData', legacyDirectory);
} else {
  mkdirSync(currentDirectory, { recursive: true });
  app.setPath('userData', currentDirectory);
}
