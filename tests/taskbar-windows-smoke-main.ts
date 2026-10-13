/** Standalone fixture entry: only packaged into the disposable test-player ASAR. */
import { app, BrowserWindow, ipcMain, nativeImage, session } from 'electron';
import type { IpcMainEvent, ThumbarButton } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { initializeTaskbar } from '../src/main/modules/taskbar';
import { getTaskbarButtonCreatedMessage } from '../src/main/modules/taskbarPreview';
import { TASKBAR_STATE_CHANNEL, type TaskbarState } from '../src/shared/taskbar';

const fixtureDirectory = process.env.ZEPHYRUS_TASKBAR_SMOKE_DIR;
if (!fixtureDirectory || process.platform !== 'win32') app.exit(2);
const directory = resolve(fixtureDirectory!);
mkdirSync(join(directory, 'profile'), { recursive: true });
mkdirSync(join(directory, 'session'), { recursive: true });
app.setName('ZephyrusTaskbarApiFixture');
app.setPath('userData', join(directory, 'profile'));
app.setPath('sessionData', join(directory, 'session'));
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');

type NativeCall = {
  stage: string;
  returned: boolean;
  buttonCount: number;
  tooltips: string[];
  icons: Array<{ empty: boolean; width: number; height: number }>;
  disabled: boolean[];
};
const evidence = {
  fixture: 'isolated-native-taskbar-api',
  platform: process.platform,
  electron: process.versions.electron,
  credentialsRead: false,
  musicPlayed: false,
  externalRequestsBlocked: 0,
  stateIpc: [] as string[],
  nativeCalls: [] as NativeCall[],
  thumbnailTooltips: [] as string[],
  iconAssets: [] as Array<{ name: string; empty: boolean; width: number; height: number }>,
  controlsDispatched: [] as string[],
  lifecycle: [] as string[],
  taskbarCreatedEvents: 0,
  prematureButtonCalls: 0,
  checks: {} as Record<string, boolean>,
  errors: [] as string[],
  diagnostics: [] as string[],
  success: false
};
let window: BrowserWindow | null = null;
let dispose: (() => void) | undefined;
let stage = 'startup';
let latestButtons: ThumbarButton[] = [];
let finished = false;
let resolveStage: (() => void) | undefined;

function output() {
  writeFileSync(
    join(directory, 'native-evidence.json'),
    JSON.stringify(evidence, null, 2) + '\n',
    'utf8'
  );
}
function isFixture(event: IpcMainEvent) {
  return (
    window &&
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame
  );
}
function finish(reason?: string) {
  if (finished) return;
  finished = true;
  if (reason) evidence.errors.push(reason);
  evidence.lifecycle.push('auto-exit');
  const before = evidence.controlsDispatched.length;
  if (window && !window.isDestroyed()) window.destroy();
  dispose?.();
  for (const button of latestButtons) button.click();
  evidence.checks.closedCallbacksInert = before === evidence.controlsDispatched.length;
  evidence.checks.listenersRemoved = ipcMain.listenerCount(TASKBAR_STATE_CHANNEL) === 0;
  evidence.success = evidence.errors.length === 0 && Object.values(evidence.checks).every(Boolean);
  output();
  app.exit(evidence.success ? 0 : 1);
}

process.on('uncaughtException', () => finish('uncaught-exception'));
process.on('unhandledRejection', () => finish('unhandled-rejection'));
app.on('window-all-closed', () => {});

async function sendFixtureStage(label: string, state: TaskbarState) {
  stage = label;
  await new Promise<void>((resolveStagePromise, reject) => {
    const timeout = setTimeout(() => reject(new Error('fixture-stage-timeout')), 1800);
    resolveStage = () => {
      clearTimeout(timeout);
      resolveStage = undefined;
      resolveStagePromise();
    };
    window!.webContents.send('taskbar:fixture-state', { label, state });
  });
  // Let native retries occur if Explorer has not yet attached this taskbar window.
  await new Promise((resolveStageDelay) => setTimeout(resolveStageDelay, 180));
}

void app
  .whenReady()
  .then(async () => {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (_details, callback) => {
        evidence.externalRequestsBlocked++;
        callback({ cancel: true });
      }
    );
    for (const name of ['prev', 'play', 'pause', 'next', 'favorite', 'favorite-active']) {
      const icon = nativeImage.createFromPath(
        join(app.getAppPath(), 'resources/icons', `${name}.png`)
      );
      const size = icon.getSize();
      evidence.iconAssets.push({
        name,
        empty: icon.isEmpty(),
        width: size.width,
        height: size.height
      });
    }
    window = new BrowserWindow({
      width: 500,
      height: 260,
      show: false,
      skipTaskbar: false,
      title: '任务栏 API 隔离检查 · 自动退出',
      backgroundColor: '#171b25',
      webPreferences: {
        preload: join(__dirname, 'fixture-preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    evidence.lifecycle.push('isolated-window-created');
    const createdMessage = getTaskbarButtonCreatedMessage();
    evidence.checks.readinessMessageRegistered = createdMessage !== null;
    const originalHook = window.hookWindowMessage.bind(window);
    window.hookWindowMessage = (message, callback) => {
      originalHook(message, (wParam, lParam) => {
        if (message === createdMessage) {
          evidence.taskbarCreatedEvents++;
          evidence.lifecycle.push('native-taskbar-button-created');
        }
        callback(wParam, lParam);
      });
    };
    const originalSetButtons = window.setThumbarButtons.bind(window);
    window.setThumbarButtons = (buttons) => {
      if (!evidence.taskbarCreatedEvents) evidence.prematureButtonCalls++;
      latestButtons = buttons;
      const returned = originalSetButtons(buttons);
      evidence.nativeCalls.push({
        stage,
        returned,
        buttonCount: buttons.length,
        tooltips: buttons.map((button) => button.tooltip || ''),
        icons: buttons.map((button) => {
          const icon = button.icon as Electron.NativeImage;
          const size = icon.getSize();
          return { empty: icon.isEmpty(), width: size.width, height: size.height };
        }),
        disabled: buttons.map((button) => button.flags?.includes('disabled') || false)
      });
      return returned;
    };
    const originalTooltip = window.setThumbnailToolTip.bind(window);
    window.setThumbnailToolTip = (text) => {
      originalTooltip(text);
      evidence.thumbnailTooltips.push(text);
    };
    ipcMain.on('taskbar:fixture-ack', (event: IpcMainEvent, label: string) => {
      if (!isFixture(event) || label !== stage) return;
      evidence.stateIpc.push(label);
      resolveStage?.();
    });
    ipcMain.on('taskbar:fixture-action', (event: IpcMainEvent, action: string) => {
      if (
        isFixture(event) &&
        ['prevPlay', 'togglePlay', 'nextPlay', 'toggleFavorite'].includes(action)
      ) {
        evidence.controlsDispatched.push(action);
      }
    });
    window.once('closed', () => evidence.lifecycle.push('isolated-window-closed'));
    window.webContents.on('did-fail-load', (_event, code, description) => {
      evidence.errors.push(
        `fixture-load:${code}:${/^[A-Z_]+$/.test(description) ? description : 'failed'}`
      );
    });
    window.webContents.on('render-process-gone', (_event, details) =>
      evidence.errors.push(`renderer-gone:${details.reason}`)
    );
    window.webContents.on('preload-error', () => evidence.errors.push('fixture-preload-failed'));
    dispose = initializeTaskbar(window);
    evidence.checks.hiddenStartupDeferred = evidence.nativeCalls.length === 0;
    evidence.lifecycle.push('fixture-load-start');
    await window.loadFile(join(__dirname, 'fixture.html'));
    evidence.lifecycle.push('fixture-load-complete');
    window.showInactive();
    evidence.lifecycle.push('isolated-window-visible');
    await new Promise((resolveStageDelay) => setTimeout(resolveStageDelay, 600));
    evidence.checks.realShellReadinessObserved = evidence.taskbarCreatedEvents > 0;
    evidence.checks.noPrematureButtonCalls = evidence.prematureButtonCalls === 0;
    const paused: TaskbarState = {
      songId: 'kugou:fixture-only',
      title: '隔离测试曲',
      artist: '测试歌手',
      isPlaying: false,
      isFavorite: false,
      canFavorite: true,
      favoriteIsLocal: true
    };
    await sendFixtureStage('paused', paused);
    await sendFixtureStage('playing', { ...paused, isPlaying: true });
    await sendFixtureStage('favorite', { ...paused, isPlaying: true, isFavorite: true });
    await sendFixtureStage('new-track-paused', {
      ...paused,
      songId: 'qq:fixture-only',
      title: '另一首隔离测试曲',
      artist: '另一位测试歌手'
    });
    for (const button of latestButtons) button.click();
    await new Promise((resolveStageDelay) => setTimeout(resolveStageDelay, 180));

    const successful = evidence.nativeCalls.filter((call) => call.returned);
    const stateSeen = (name: string, playTooltip: string, favoriteTooltip: string) =>
      successful.some(
        (call) =>
          call.stage === name &&
          call.tooltips[1] === playTooltip &&
          call.tooltips[3] === favoriteTooltip &&
          call.buttonCount === 4 &&
          call.icons.every((icon) => !icon.empty) &&
          call.disabled.every((disabled) => !disabled)
      );
    evidence.checks.nativeApiReturnedTrue = successful.length > 0;
    evidence.checks.sixSourceIconsNonempty =
      evidence.iconAssets.length === 6 && evidence.iconAssets.every((icon) => !icon.empty);
    evidence.checks.pausedStateApplied = stateSeen('paused', '播放', '收藏到本机');
    evidence.checks.playingStateApplied = stateSeen('playing', '暂停', '收藏到本机');
    evidence.checks.favoriteStateApplied = stateSeen('favorite', '暂停', '取消本机收藏');
    evidence.checks.newTrackStateApplied = stateSeen('new-track-paused', '播放', '收藏到本机');
    evidence.checks.mainFrameIpcWorked =
      evidence.stateIpc.join(',') === 'paused,playing,favorite,new-track-paused';
    evidence.checks.fourExistingActionsDispatched =
      evidence.controlsDispatched.join(',') === 'prevPlay,togglePlay,nextPlay,toggleFavorite';
    evidence.checks.metadataTooltipUpdated =
      evidence.thumbnailTooltips.includes('另一首隔离测试曲 — 另一位测试歌手');
    evidence.checks.noExternalRequests = evidence.externalRequestsBlocked === 0;
    finish();
  })
  .catch((error: unknown) => {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const name = error instanceof Error ? error.name : 'unknown';
    if (error instanceof Error)
      evidence.diagnostics.push(
        error.message.replace(/E:[^\s"']*/gi, '[fixture-path]').slice(0, 220)
      );
    finish(`fixture-initialization-failed:${/^[a-zA-Z0-9_-]+$/.test(code) ? code : name}`);
  });

setTimeout(() => finish('fixture-overall-timeout'), 11000).unref();
