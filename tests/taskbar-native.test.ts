import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, test } from 'node:test';
import type { BrowserWindow, ThumbarButton } from 'electron';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';

import { initializeTaskbar } from '../src/main/modules/taskbar';
import type { TaskbarPreviewState } from '../src/main/modules/taskbarPreview';
import { useFavorite } from '../src/renderer/hooks/useFavorite';
import { useFavoriteStore } from '../src/renderer/store/modules/favorite';
import type { SongResult } from '../src/renderer/types/music';
import { cleanupAppShortcuts, initAppShortcuts } from '../src/renderer/utils/appShortcuts';
import { getSongFavoriteId } from '../src/renderer/utils/songFavorite';
import { projectTaskbarState } from '../src/renderer/utils/taskbarState';
import {
  emptyTaskbarState,
  normalizeTaskbarState,
  TASKBAR_REQUEST_CHANNEL,
  TASKBAR_STATE_CHANNEL
} from '../src/shared/taskbar';
import {
  ipcMain,
  nativeImage,
  nativeTheme,
  TASKBAR_BUTTON_CREATED_MESSAGE,
  TaskbarWindowFixture
} from './helpers/taskbar-electron-fixture';
import { accountWrites, isLyricWindow, rendererPlayer } from './helpers/taskbar-renderer-fixture';

const windows: TaskbarWindowFixture[] = [];
const disposers: Array<() => void> = [];
let savedValues = new Map<string, string>();
let rendererIpc: EventEmitter;
let fixtureTime = 10000;

function song(id: string | number, platform?: string): SongResult {
  return { id, platform, name: '隔离测试曲', ar: [{ name: '测试歌手' }] } as SongResult;
}
function createWindow(createPreview?: Parameters<typeof initializeTaskbar>[1]) {
  const window = new TaskbarWindowFixture();
  windows.push(window);
  disposers.push(
    initializeTaskbar(
      window as unknown as BrowserWindow,
      createPreview,
      () => TASKBAR_BUTTON_CREATED_MESSAGE
    )
  );
  return window;
}
function sendState(
  window: TaskbarWindowFixture,
  currentSong: SongResult = song('kugou:test', 'kugou'),
  playing = false
) {
  ipcMain.emit(
    TASKBAR_STATE_CHANNEL,
    window.event(),
    projectTaskbarState(currentSong, playing, () => false)
  );
}
function click(button: ThumbarButton) {
  button.click();
}
function linkRenderer(window: TaskbarWindowFixture) {
  const bridge = (globalThis.window as Window).electron.ipcRenderer;
  bridge.send = (channel: string, ...args: unknown[]) => {
    ipcMain.emit(channel, window.event(), ...args);
  };
  window.webContents.on('fixture-send', (channel: string, ...args: unknown[]) => {
    rendererIpc.emit(channel, {}, ...args);
  });
}

beforeEach((context) => {
  setActivePinia(createPinia());
  savedValues = new Map();
  rendererIpc = new EventEmitter();
  const storage = {
    getItem: (key: string) => savedValues.get(key) ?? null,
    setItem: (key: string, value: string) => savedValues.set(key, value)
  };
  const fixtureBridge = {
    send: () => {},
    sendSync: () => null,
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      rendererIpc.on(channel, listener);
      return () => rendererIpc.removeListener(channel, listener);
    },
    removeListener: (channel: string, listener: (...args: unknown[]) => void) =>
      rendererIpc.removeListener(channel, listener)
  };
  Object.assign(globalThis, {
    localStorage: storage,
    window: { electron: { ipcRenderer: fixtureBridge } },
    document: { addEventListener() {}, removeEventListener() {} }
  });
  accountWrites.length = 0;
  rendererPlayer.playMusic = {} as SongResult;
  rendererPlayer.play = rendererPlayer.isPlay = false;
  rendererPlayer.actions = [];
  isLyricWindow.value = false;
  context.mock.method(Date, 'now', () => (fixtureTime += 300));
});

afterEach(() => {
  cleanupAppShortcuts();
  for (const dispose of disposers.splice(0)) dispose();
  for (const window of windows.splice(0)) window.close();
  nativeImage.forceEmpty = false;
  nativeTheme.shouldUseDarkColors = false;
});

test('missing or empty native icons leave the normal window thumbnail without throwing', () => {
  nativeImage.forceEmpty = true;
  const window = createWindow();
  assert.equal(window.attempts, 0);
  assert.equal(ipcMain.listenerCount(TASKBAR_STATE_CHANNEL), 0);
});

test('the four native buttons are disabled until the main renderer reports its state', () => {
  const window = createWindow();
  assert.deepEqual(
    window.buttons.map((button) => button.tooltip),
    ['上一首', '播放', '下一首', '收藏当前歌曲']
  );
  assert.ok(window.buttons.every((button) => button.flags?.includes('disabled')));
  for (const button of window.buttons) click(button);
  assert.equal(window.webContents.sends.length, 0);

  sendState(window);
  assert.ok(window.buttons.every((button) => !button.flags?.includes('disabled')));
  for (const button of window.buttons) click(button);
  assert.deepEqual(
    window.webContents.sends.map((sent) => sent.args[0]),
    ['prevPlay', 'togglePlay', 'nextPlay', 'toggleFavorite']
  );
  assert.equal(window.tooltips.at(-1), '隔离测试曲 — 测试歌手');
});

test('Windows theme changes refresh contrasting icons and closing releases the theme listener', () => {
  const window = createWindow();
  sendState(window, song('kugou:test', 'kugou'), true);
  const iconNames = () =>
    window.buttons.map((button) => (button.icon as unknown as { name: string }).name);
  assert.deepEqual(iconNames(), ['prev.png', 'pause.png', 'next.png', 'favorite.png']);
  nativeTheme.shouldUseDarkColors = true;
  nativeTheme.emit('updated');
  assert.deepEqual(iconNames(), [
    'prev-dark.png',
    'pause-dark.png',
    'next-dark.png',
    'favorite-dark.png'
  ]);
  assert.equal(window.tooltips.at(-1), '隔离测试曲 — 测试歌手');
  window.close();
  const before = window.attempts;
  nativeTheme.emit('updated');
  assert.equal(window.attempts, before);
  assert.equal(nativeTheme.listenerCount('updated'), 0);
});

test('song preview updates when titles change without button changes, then clears on renderer reload', () => {
  const states: TaskbarPreviewState[] = [];
  let disposed = 0;
  const window = createWindow(() => ({
    update(value) {
      states.push({ title: value.title, artist: value.artist, isPlaying: value.isPlaying });
    },
    dispose() {
      disposed++;
    }
  }));
  sendState(window, song('kugou:first', 'kugou'), true);
  const buttonAttempts = window.attempts;
  sendState(window, { ...song('kugou:second', 'kugou'), name: '第二首' }, true);
  assert.equal(window.attempts, buttonAttempts);
  assert.deepEqual(states.at(-1), { title: '第二首', artist: '测试歌手', isPlaying: true });
  ipcMain.emit('update-play-state', window.event(), false);
  assert.equal(states.at(-1)?.isPlaying, false);
  window.webContents.emit('did-start-navigation', {}, 'file:///fixture', false, true);
  assert.deepEqual(states.at(-1), { title: '', artist: '', isPlaying: false });
  window.close();
  assert.equal(disposed, 1);
  const updates = states.length;
  sendState(window);
  assert.equal(states.length, updates);
});

test('failed preview initialization or updates preserve all playback buttons and listener cleanup', () => {
  const window = createWindow(() => {
    throw new Error('native-unavailable');
  });
  sendState(window);
  assert.equal(window.buttons.length, 4);
  assert.ok(window.buttons.every((button) => !button.flags?.includes('disabled')));

  let cleanupCount = 0;
  const failed = createWindow(() => ({
    update() {
      throw new Error('native-submission-failed');
    },
    dispose() {
      cleanupCount++;
      throw new Error('native-cleanup-failed');
    }
  }));
  sendState(failed);
  assert.equal(failed.buttons.length, 4);
  assert.equal(cleanupCount, 1);
  window.close();
  failed.close();
  assert.equal(nativeTheme.listenerCount('updated'), 0);
  assert.equal(ipcMain.listenerCount(TASKBAR_STATE_CHANNEL), 0);
});

test('initialization retries an unavailable taskbar, then show/focus/restore request fresh state', async () => {
  const window = new TaskbarWindowFixture();
  windows.push(window);
  window.nativeResults.push(false, true);
  disposers.push(
    initializeTaskbar(
      window as unknown as BrowserWindow,
      undefined,
      () => TASKBAR_BUTTON_CREATED_MESSAGE
    )
  );
  assert.equal(window.attempts, 1);
  await delay(190);
  assert.equal(window.attempts, 2);
  for (const event of ['ready-to-show', 'show', 'focus', 'restore']) window.emit(event);
  window.webContents.emit('did-finish-load');
  assert.equal(
    window.webContents.sends.filter((sent) => sent.channel === TASKBAR_REQUEST_CHANNEL).length,
    5
  );
});

test('a hidden startup waits for the real taskbar button even after show and renderer playback', async () => {
  const window = new TaskbarWindowFixture();
  window.visible = false;
  windows.push(window);
  disposers.push(
    initializeTaskbar(
      window as unknown as BrowserWindow,
      undefined,
      () => TASKBAR_BUTTON_CREATED_MESSAGE
    )
  );
  sendState(window, song('kugou:startup', 'kugou'), true);
  window.visible = true;
  for (const event of ['ready-to-show', 'show', 'focus']) window.emit(event);
  window.webContents.emit('did-finish-load');
  await delay(20);
  assert.equal(window.attempts, 0);

  window.postMessage(TASKBAR_BUTTON_CREATED_MESSAGE);
  assert.equal(window.attempts, 0, 'submission must wait until native message handling completes');
  await delay(20);
  assert.equal(window.attempts, 1);
  assert.equal(window.buttons[1].tooltip, '暂停');
  assert.ok(window.buttons.every((button) => !button.flags?.includes('disabled')));
  click(window.buttons[2]);
  assert.equal(window.webContents.sends.at(-1)?.args[0], 'nextPlay');
});

test('taskbar creation invalidates an earlier success and submits the latest unchanged button state', async () => {
  const window = createWindow();
  sendState(window, song('kugou:first', 'kugou'), true);
  const before = window.attempts;
  window.postMessage(TASKBAR_BUTTON_CREATED_MESSAGE);
  sendState(window, { ...song('qq:latest', 'qq'), name: '最新曲目' }, true);
  assert.equal(window.attempts, before);
  await delay(20);
  assert.equal(window.attempts, before + 1);
  assert.equal(window.tooltips.at(-1), '最新曲目 — 测试歌手');
  assert.equal(window.buttons[1].tooltip, '暂停');
});

test('a show event in the same native message turn preserves the pending readiness submission', async () => {
  const window = new TaskbarWindowFixture();
  window.visible = false;
  windows.push(window);
  disposers.push(
    initializeTaskbar(
      window as unknown as BrowserWindow,
      undefined,
      () => TASKBAR_BUTTON_CREATED_MESSAGE
    )
  );
  sendState(window, song('kugou:same-turn', 'kugou'), true);
  window.visible = true;
  window.postMessage(TASKBAR_BUTTON_CREATED_MESSAGE);
  window.emit('show');
  assert.equal(window.attempts, 0);
  await delay(20);
  assert.equal(window.attempts, 1);
  assert.equal(window.buttons[1].tooltip, '暂停');
});

test('hiding cancels a pending ready message and showing waits for the recreated taskbar button', async () => {
  const window = createWindow();
  sendState(window);
  window.postMessage(TASKBAR_BUTTON_CREATED_MESSAGE);
  window.visible = false;
  window.emit('hide');
  const before = window.attempts;
  await delay(20);
  assert.equal(window.attempts, before);
  window.visible = true;
  window.emit('show');
  sendState(window, song('kugou:restored', 'kugou'), true);
  await delay(20);
  assert.equal(window.attempts, before);
  window.postMessage(TASKBAR_BUTTON_CREATED_MESSAGE);
  await delay(20);
  assert.equal(window.attempts, before + 1);
  assert.equal(window.buttons[1].tooltip, '暂停');
});

test('a delayed native creation message after hiding cannot submit buttons for a hidden window', async () => {
  const window = createWindow();
  sendState(window, song('kugou:hidden', 'kugou'), true);
  window.visible = false;
  window.emit('hide');
  const before = window.attempts;
  window.postMessage(TASKBAR_BUTTON_CREATED_MESSAGE);
  await delay(190);
  assert.equal(window.attempts, before);
  window.visible = true;
  window.emit('show');
  window.postMessage(TASKBAR_BUTTON_CREATED_MESSAGE);
  await delay(20);
  assert.equal(window.attempts, before + 1);
  assert.equal(window.buttons[1].tooltip, '暂停');
});

test('a minimized window keeps its taskbar button and accepts recreation without requiring restore', async () => {
  const window = createWindow();
  sendState(window, song('kugou:minimized', 'kugou'), true);
  window.visible = false;
  window.minimized = true;
  window.emit('minimize');
  const before = window.attempts;
  window.postMessage(TASKBAR_BUTTON_CREATED_MESSAGE);
  await delay(20);
  assert.equal(window.attempts, before + 1);
  assert.equal(window.buttons[1].tooltip, '暂停');
  window.emit('hide');
  window.postMessage(TASKBAR_BUTTON_CREATED_MESSAGE);
  await delay(190);
  assert.equal(window.attempts, before + 1);
});

test('disposing removes only the owned readiness hook and cancels deferred submissions', async () => {
  const window = createWindow();
  const callback = window.messageHooks.get(TASKBAR_BUTTON_CREATED_MESSAGE)!;
  window.postMessage(TASKBAR_BUTTON_CREATED_MESSAGE);
  const before = window.attempts;
  disposers.at(-1)!();
  assert.equal(window.messageHooks.has(TASKBAR_BUTTON_CREATED_MESSAGE), false);
  callback(Buffer.alloc(8), Buffer.alloc(8));
  await delay(190);
  assert.equal(window.attempts, before);
  assert.equal(window.listenerCount('show'), 0);
  assert.equal(window.listenerCount('hide'), 0);
});

test('an unavailable or already owned readiness hook preserves the ordinary toolbar fallback', () => {
  for (const message of [null, TASKBAR_BUTTON_CREATED_MESSAGE]) {
    const window = new TaskbarWindowFixture();
    windows.push(window);
    const existing = () => {};
    if (message !== null) window.hookWindowMessage(message, existing);
    const dispose = initializeTaskbar(window as unknown as BrowserWindow, undefined, () => message);
    disposers.push(dispose);
    sendState(window);
    assert.equal(window.buttons.length, 4);
    dispose();
    if (message !== null) assert.equal(window.messageHooks.get(message), existing);
  }
});

test('successful shell readiness refreshes are bounded and retain playback state', async () => {
  const window = createWindow();
  sendState(window, song('kugou:bounded', 'kugou'), true);
  const before = window.attempts;
  window.postMessage(TASKBAR_BUTTON_CREATED_MESSAGE);
  await delay(2650);
  assert.equal(window.attempts, before + 5);
  await delay(190);
  assert.equal(window.attempts, before + 5);
  assert.equal(window.buttons[1].tooltip, '暂停');
});

test('invalid IPC, other windows and iframe messages cannot change the buttons', () => {
  const window = createWindow();
  sendState(window);
  const before = window.attempts;
  const playing = { ...projectTaskbarState(song('kugou:test', 'kugou'), true, () => true) };
  ipcMain.emit(TASKBAR_STATE_CHANNEL, { ...window.event(), sender: {} }, playing);
  ipcMain.emit(TASKBAR_STATE_CHANNEL, { ...window.event(), senderFrame: {} }, playing);
  ipcMain.emit(TASKBAR_STATE_CHANNEL, window.event(), { ...playing, isPlaying: 'true' });
  ipcMain.emit('update-play-state', window.event(), 'false');
  assert.equal(window.attempts, before);
  assert.equal(window.buttons[1].tooltip, '播放');
  assert.equal(window.buttons[3].tooltip, '收藏到本机');
});

test('a taskbar lost after earlier initialization also retries an unchanged button state', async () => {
  const window = createWindow();
  sendState(window);
  const before = window.attempts;
  window.nativeResults.push(false, true);
  window.emit('focus');
  assert.equal(window.attempts, before + 1);
  await delay(190);
  assert.equal(window.attempts, before + 2);
});

test('closing during an initialization retry releases listeners, cancels the timer and makes old callbacks inert', async () => {
  const window = new TaskbarWindowFixture();
  windows.push(window);
  window.nativeResults.push(new Error('Native taskbar not ready'));
  disposers.push(
    initializeTaskbar(
      window as unknown as BrowserWindow,
      undefined,
      () => TASKBAR_BUTTON_CREATED_MESSAGE
    )
  );
  const buttons = window.buttons;
  window.close();
  const attempts = window.attempts;
  for (const button of buttons) click(button);
  ipcMain.emit(
    TASKBAR_STATE_CHANNEL,
    window.event(),
    projectTaskbarState(song(12), true, () => true)
  );
  await delay(190);
  assert.equal(window.attempts, attempts);
  assert.equal(window.webContents.sends.length, 0);
  assert.equal(ipcMain.listenerCount(TASKBAR_STATE_CHANNEL), 0);
  assert.equal(ipcMain.listenerCount('update-play-state'), 0);
  assert.equal(window.webContents.listenerCount('did-finish-load'), 0);
});

test('window guards tolerate webContents destruction before the window closes', () => {
  const window = createWindow();
  sendState(window);
  const buttons = window.buttons;
  window.webContents.destroyed = true;
  for (const button of buttons) click(button);
  window.emit('focus');
  assert.equal(window.webContents.sends.length, 0);
});

test('native toolbar APIs are skipped on other operating systems', () => {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  try {
    const window = createWindow();
    assert.equal(window.attempts, 0);
    assert.equal(ipcMain.listenerCount(TASKBAR_STATE_CHANNEL), 0);
  } finally {
    Object.defineProperty(process, 'platform', descriptor);
  }
});

test('the real shortcut handler toggles a Kugou local favorite and all native/play-bar states follow', async () => {
  const window = createWindow();
  linkRenderer(window);
  rendererPlayer.playMusic = song('kugou:test', 'kugou');
  initAppShortcuts();
  const favorites = useFavoriteStore();
  const playBar = useFavorite();
  assert.equal(window.buttons[3].tooltip, '收藏到本机');

  click(window.buttons[3]);
  await nextTick();
  assert.deepEqual(favorites.favoriteList, ['kugou:test']);
  assert.equal(JSON.parse(savedValues.get('favoriteList')!)[0], 'kugou:test');
  assert.equal(playBar.isFavorite.value, true);
  assert.equal(window.buttons[3].tooltip, '取消本机收藏');
  assert.equal(accountWrites.length, 0);

  await playBar.toggleFavorite();
  await nextTick();
  assert.deepEqual(favorites.favoriteList, []);
  assert.equal(window.buttons[3].tooltip, '收藏到本机');

  await favorites.addToFavorite('kugou:test');
  await nextTick();
  assert.equal(window.buttons[3].tooltip, '取消本机收藏');
  click(window.buttons[3]);
  await nextTick();
  assert.deepEqual(favorites.favoriteList, []);
  assert.equal(accountWrites.length, 0);
});

test('native previous/play-pause/next actions run the existing shortcuts and pause icon tracks actual state', async () => {
  const window = createWindow();
  linkRenderer(window);
  rendererPlayer.playMusic = song('kugou:test', 'kugou');
  initAppShortcuts();
  click(window.buttons[0]);
  click(window.buttons[1]);
  click(window.buttons[2]);
  await nextTick();
  assert.deepEqual(rendererPlayer.actions, ['previous', 'play', 'next']);
  assert.equal(window.buttons[1].tooltip, '暂停');
  click(window.buttons[1]);
  await nextTick();
  assert.equal(rendererPlayer.actions.at(-1), 'pause');
  assert.equal(window.buttons[1].tooltip, '播放');

  ipcMain.emit('update-play-state', window.event(), true);
  assert.equal(window.buttons[1].tooltip, '暂停');
  ipcMain.emit('update-play-state', window.event(), false);
  assert.equal(window.buttons[1].tooltip, '播放');
});

test('a new track changes collection status and metadata; a reload disables stale native callbacks', async () => {
  const window = createWindow();
  linkRenderer(window);
  rendererPlayer.playMusic = song('kugou:liked', 'kugou');
  await useFavoriteStore().addToFavorite('kugou:liked');
  initAppShortcuts();
  assert.equal(window.buttons[3].tooltip, '取消本机收藏');
  rendererPlayer.playMusic = { ...song('qq:different', 'qq'), name: '<b>新曲</b>', ar: [] };
  await nextTick();
  assert.equal(window.buttons[3].tooltip, '收藏到本机');
  assert.equal(window.tooltips.at(-1), '新曲');

  window.webContents.emit('did-start-navigation', {}, 'file:///fixture', true, true);
  assert.ok(window.buttons.every((button) => !button.flags?.includes('disabled')));
  window.webContents.emit('did-start-navigation', {}, 'file:///fixture', false, true);
  assert.ok(window.buttons.every((button) => button.flags?.includes('disabled')));
  click(window.buttons[3]);
  assert.deepEqual(useFavoriteStore().favoriteList, ['kugou:liked']);
  window.webContents.emit('did-finish-load');
  assert.ok(window.buttons.every((button) => !button.flags?.includes('disabled')));
});

test('numeric NetEase IDs still use the existing favorite API while QQ, Kugou and Bilibili stay local', async () => {
  const window = createWindow();
  linkRenderer(window);
  rendererPlayer.playMusic = song('12345', 'netease');
  initAppShortcuts();
  click(window.buttons[3]);
  await delay(0);
  await nextTick();
  assert.deepEqual(useFavoriteStore().favoriteList, [12345]);
  assert.deepEqual(accountWrites, [{ id: 12345, like: true }]);
  assert.equal(window.buttons[3].tooltip, '取消收藏');

  for (const currentSong of [
    song('qq:test', 'qq'),
    song('kugou:test', 'kugou'),
    song('BVtest--1--9')
  ]) {
    rendererPlayer.playMusic = currentSong;
    await nextTick();
    click(window.buttons[3]);
    await nextTick();
  }
  assert.deepEqual(useFavoriteStore().favoriteList, [
    12345,
    'qq:test',
    'kugou:test',
    'BVtest--1--9'
  ]);
  assert.equal(accountWrites.length, 1);
});

test('artist fallback, malformed song IDs and missing tracks never send invalid favorite identities', () => {
  assert.equal(getSongFavoriteId(song('kugou:test', 'kugou')), 'kugou:test');
  assert.equal(getSongFavoriteId(song(123, 'qq')), 'qq:123');
  assert.equal(getSongFavoriteId(song('123', 'qq')), '123');
  assert.equal(getSongFavoriteId(song('BVtest--1--9', 'bilibili')), 'BVtest--1--9');
  assert.equal(getSongFavoriteId(song('BVtest--1--9')), 'BVtest--1--9');
  for (const id of [0, NaN, Infinity, -1, '', '  '])
    assert.equal(getSongFavoriteId(song(id)), null);
  const projected = projectTaskbarState(
    { ...song('kugou:test', 'kugou'), ar: [], artists: [{ name: '备用歌手' }] } as SongResult,
    false,
    () => false
  );
  assert.equal(projected.artist, '备用歌手');
  assert.deepEqual(
    normalizeTaskbarState({
      ...emptyTaskbarState(),
      isPlaying: true,
      isFavorite: true,
      canFavorite: true
    }),
    emptyTaskbarState()
  );
});

test('renderer cleanup stops state observers and listeners, and lyric windows never publish main-window state', async () => {
  const window = createWindow();
  linkRenderer(window);
  rendererPlayer.playMusic = song('kugou:test', 'kugou');
  initAppShortcuts();
  cleanupAppShortcuts();
  const before = window.attempts;
  rendererPlayer.play = rendererPlayer.isPlay = true;
  await useFavoriteStore().addToFavorite('kugou:test');
  await nextTick();
  assert.equal(window.attempts, before);
  assert.equal(rendererIpc.listenerCount(TASKBAR_REQUEST_CHANNEL), 0);
  assert.equal(rendererIpc.listenerCount('global-shortcut'), 0);

  isLyricWindow.value = true;
  initAppShortcuts();
  assert.equal(rendererIpc.listenerCount(TASKBAR_REQUEST_CHANNEL), 0);
  assert.equal(window.attempts, before);
});
