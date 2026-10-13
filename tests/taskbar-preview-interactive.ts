/** Manual Explorer hover check in the existing test copy; no account, network or audio. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

import { app, BrowserWindow, ipcMain, session } from 'electron';

import { initializeTaskbar } from '../src/main/modules/taskbar';
import type { TaskbarState } from '../src/shared/taskbar';

const directory = resolve(process.env.ZEPHYRUS_PREVIEW_TEST_DIR!);
mkdirSync(join(directory, 'profile'), { recursive: true });
mkdirSync(join(directory, 'session'), { recursive: true });
app.setName('歌曲预览测试');
app.setAppUserModelId('com.zephyrus.preview-fixture');
app.setPath('userData', join(directory, 'profile'));
app.setPath('sessionData', join(directory, 'session'));
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');

const evidence = {
  fixture: 'actual-explorer-hover',
  syntheticMessagesSent: 0,
  externalRequestsBlocked: 0,
  thumbnailCalls: [] as Array<{ result: number; at: string }>,
  liveCalls: [] as number[],
  nativeButtons: [] as boolean[],
  actions: [] as string[],
  success: false
};
let window: BrowserWindow | undefined;
let dispose: (() => void) | undefined;
let exitTimer: ReturnType<typeof setTimeout> | undefined;
let finished = false;
let state: TaskbarState = {
  songId: 'kugou:fixture-only',
  title: '风经过这里',
  artist: '隔离测试歌手',
  isPlaying: true,
  canFavorite: true,
  isFavorite: false,
  favoriteIsLocal: true
};
function output() {
  writeFileSync(join(directory, 'native-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
}
function finish() {
  if (finished) return;
  finished = true;
  if (exitTimer) clearTimeout(exitTimer);
  evidence.success =
    evidence.thumbnailCalls.some((call) => call.result === 0) &&
    evidence.nativeButtons.some(Boolean) &&
    evidence.externalRequestsBlocked === 0;
  dispose?.();
  if (window && !window.isDestroyed()) window.destroy();
  output();
  app.exit(evidence.success ? 0 : 1);
}
process.on('uncaughtException', finish);
process.on('unhandledRejection', finish);
app.on('window-all-closed', finish);

void app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (_details, callback) => {
      evidence.externalRequestsBlocked++;
      callback({ cancel: true });
    }
  );
  const requireNative = createRequire(join(app.getAppPath(), 'package.json'));
  const koffi = requireNative(join(app.getAppPath(), 'resources/taskbar-native/koffi/index.cjs'));
  const load = koffi.load.bind(koffi);
  koffi.load = (path: string) => {
    const library = load(path);
    return {
      func(declaration: string) {
        const fn = library.func(declaration);
        if (!declaration.includes('DwmSetIconic')) return fn;
        return (...args: unknown[]) => {
          const result = fn(...args);
          if (declaration.includes('DwmSetIconicThumbnail')) {
            evidence.thumbnailCalls.push({ result, at: new Date().toISOString() });
            if (result === 0 && !exitTimer) exitTimer = setTimeout(finish, 25000);
          } else {
            evidence.liveCalls.push(result);
          }
          output();
          return result;
        };
      }
    };
  };
  window = new BrowserWindow({
    width: 600,
    height: 280,
    show: false,
    skipTaskbar: false,
    title: '歌曲预览测试',
    icon: join(app.getAppPath(), 'resources/icon.png'),
    backgroundColor: '#f5f3ec',
    webPreferences: {
      preload: join(__dirname, 'fixture-preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const setButtons = window.setThumbarButtons.bind(window);
  window.setThumbarButtons = (buttons) => {
    const result = setButtons(buttons);
    evidence.nativeButtons.push(result);
    return result;
  };
  ipcMain.on('taskbar:fixture-action', (event, action: string) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== event.sender.mainFrame
    )
      return;
    evidence.actions.push(action);
    if (action === 'togglePlay') state.isPlaying = !state.isPlaying;
    if (action === 'toggleFavorite') state.isFavorite = !state.isFavorite;
    if (action === 'nextPlay' || action === 'prevPlay')
      state = {
        ...state,
        songId: 'qq:second-fixture',
        title: '下一首测试歌曲',
        artist: '另一位测试歌手'
      };
    window.webContents.send('taskbar:fixture-state', { label: 'interactive', state });
    output();
  });
  dispose = initializeTaskbar(window);
  await window.loadFile(join(__dirname, 'fixture.html'));
  window.showInactive();
  window.webContents.send('taskbar:fixture-state', { label: 'interactive', state });
  output();
  setTimeout(finish, 150000).unref();
});
