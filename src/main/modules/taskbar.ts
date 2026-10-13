import { join } from 'node:path';

import type { BrowserWindow, IpcMainEvent, NativeImage, ThumbarButton } from 'electron';
import { app, ipcMain, nativeImage, nativeTheme } from 'electron';

import type { ShortcutAction } from '../../shared/shortcuts';
import {
  emptyTaskbarState,
  normalizeTaskbarState,
  TASKBAR_REQUEST_CHANNEL,
  TASKBAR_STATE_CHANNEL
} from '../../shared/taskbar';
import {
  getTaskbarButtonCreatedMessage,
  initializeTaskbarPreview,
  type TaskbarPreviewController
} from './taskbarPreview';

const iconNames = ['prev', 'play', 'pause', 'next', 'favorite', 'favorite-active'] as const;
type IconName = (typeof iconNames)[number];
const iconCache = new Map<string, NativeImage>();
const retryDelays = [150, 400, 1000, 2500];
const readinessDelays = [0, 150, 400, 1000, 2500];

function getIcons(dark: boolean): Record<IconName, NativeImage> | null {
  try {
    const icons = {} as Record<IconName, NativeImage>;
    for (const name of iconNames) {
      const key = `${name}${dark ? '-dark' : ''}`;
      if (!iconCache.has(key)) {
        const icon = nativeImage.createFromPath(
          join(app.getAppPath(), 'resources/icons', `${key}.png`)
        );
        if (icon.isEmpty()) return null;
        iconCache.set(key, icon);
      }
      icons[name] = iconCache.get(key)!;
    }
    return icons;
  } catch {
    return null;
  }
}

/** The toolbar and song-information preview both run in the existing main process. */
export function initializeTaskbar(
  window: BrowserWindow,
  createPreview: (window: BrowserWindow) => TaskbarPreviewController = initializeTaskbarPreview,
  getCreatedMessage: () => number | null = getTaskbarButtonCreatedMessage
): () => void {
  if (process.platform !== 'win32') return () => {};

  const contents = window.webContents;
  const initialIcons = getIcons(nativeTheme.shouldUseDarkColors);
  if (!initialIcons) {
    console.warn('[Taskbar] 任务栏图标不可用，保留窗口预览。');
    return () => {};
  }
  let icons = initialIcons;
  let preview: TaskbarPreviewController | undefined;
  try {
    preview = createPreview(window);
  } catch {
    console.warn('[Taskbar] 歌曲预览不可用，保留窗口预览。');
  }

  let disposed = false;
  let rendererReady = false;
  let state = emptyTaskbarState();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryIndex = 0;
  let lastButtons = '';
  let lastTooltip = '';
  let taskbarReady = true;
  let createdMessage: number | null = null;
  let createdMessageHooked = false;
  let windowHidden = false;
  const readinessTimers = new Set<ReturnType<typeof setTimeout>>();

  const alive = () => !disposed && !window.isDestroyed() && !contents.isDestroyed();
  const trusted = (event: IpcMainEvent) =>
    alive() && event.sender === contents && event.senderFrame === contents.mainFrame;

  const cancelRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };
  const cancelReadiness = () => {
    for (const timer of readinessTimers) clearTimeout(timer);
    readinessTimers.clear();
  };

  const sendAction = (action: ShortcutAction) => {
    if (!alive() || !rendererReady || (action === 'toggleFavorite' && !state.canFavorite)) return;
    try {
      // These actions also drive the existing tray and configurable keyboard shortcuts.
      contents.send('global-shortcut', action);
    } catch {
      // The renderer may be closing between the alive check and native dispatch.
    }
  };

  const render = (force = false) => {
    if (!alive()) return;
    try {
      preview?.update(state);
    } catch {
      try {
        preview?.dispose();
      } catch {
        // Native thumbnail failure must not interrupt the playback buttons.
      }
      preview = undefined;
    }
    if (force) {
      cancelRetry();
      retryIndex = 0;
      lastButtons = '';
    }
    // Electron marks buttons as added even if an early ThumbBarAddButtons call fails.
    if (!taskbarReady) return;
    const signature = JSON.stringify([
      rendererReady,
      state.isPlaying,
      state.isFavorite,
      state.canFavorite,
      state.favoriteIsLocal
    ]);
    try {
      const tooltip = state.title
        ? `${state.title}${state.artist ? ` — ${state.artist}` : ''}`
        : 'Almusic';
      if (force || tooltip !== lastTooltip) {
        window.setThumbnailToolTip(tooltip);
        lastTooltip = tooltip;
      }
      if (!force && signature === lastButtons) return;

      const disabled: ThumbarButton['flags'] = rendererReady ? [] : ['disabled'];
      const favoriteTooltip = state.favoriteIsLocal
        ? state.isFavorite
          ? '取消本机收藏'
          : '收藏到本机'
        : state.isFavorite
          ? '取消收藏'
          : '收藏当前歌曲';
      const success = window.setThumbarButtons([
        {
          tooltip: '上一首',
          icon: icons.prev,
          flags: disabled,
          click: () => sendAction('prevPlay')
        },
        {
          tooltip: state.isPlaying ? '暂停' : '播放',
          icon: state.isPlaying ? icons.pause : icons.play,
          flags: disabled,
          click: () => sendAction('togglePlay')
        },
        {
          tooltip: '下一首',
          icon: icons.next,
          flags: disabled,
          click: () => sendAction('nextPlay')
        },
        {
          tooltip: favoriteTooltip,
          icon: state.isFavorite ? icons['favorite-active'] : icons.favorite,
          flags: rendererReady && state.canFavorite ? [] : ['disabled'],
          click: () => sendAction('toggleFavorite')
        }
      ]);
      if (success) {
        lastButtons = signature;
        cancelRetry();
        retryIndex = 0;
        return;
      }
    } catch {
      // Taskbar readiness and a window closing must not interrupt application startup.
    }

    if (!retryTimer && retryIndex < retryDelays.length && alive()) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        render();
      }, retryDelays[retryIndex++]);
      retryTimer.unref();
    }
  };

  const requestState = () => {
    if (!alive() || contents.isLoadingMainFrame()) return;
    try {
      contents.send(TASKBAR_REQUEST_CHANNEL);
    } catch {
      // A reload can finish at the same time as window shutdown.
    }
  };
  const onReady = () => {
    render(true);
    requestState();
  };
  const scheduleReadiness = (markReady = false) => {
    cancelReadiness();
    for (const delay of readinessDelays) {
      const timer = setTimeout(() => {
        readinessTimers.delete(timer);
        if (!alive()) return;
        if (markReady) taskbarReady = true;
        onReady();
      }, delay);
      readinessTimers.add(timer);
      timer.unref();
    }
  };
  const onCreated = () => {
    if (!alive() || (windowHidden && !window.isVisible())) return;
    windowHidden = false;
    taskbarReady = false;
    lastButtons = '';
    cancelRetry();
    // Let Electron finish handling the native message before adding or updating buttons.
    scheduleReadiness(true);
  };
  const onShow = () => {
    windowHidden = false;
    onReady();
    if (!createdMessageHooked) scheduleReadiness();
  };
  const onHide = () => {
    windowHidden = true;
    if (createdMessageHooked) taskbarReady = false;
    lastButtons = '';
    cancelRetry();
    cancelReadiness();
  };
  const onTheme = () => {
    if (!alive()) return;
    const nextIcons = getIcons(nativeTheme.shouldUseDarkColors);
    if (!nextIcons) return;
    icons = nextIcons;
    render(true);
  };
  const onState = (event: IpcMainEvent, value: unknown) => {
    if (!trusted(event)) return;
    const nextState = normalizeTaskbarState(value);
    if (!nextState) return;
    state = nextState;
    rendererReady = true;
    render();
  };
  const onPlaying = (event: IpcMainEvent, playing: unknown) => {
    if (!trusted(event) || typeof playing !== 'boolean') return;
    state = { ...state, isPlaying: state.songId !== null && playing };
    render();
  };
  const resetState = () => {
    rendererReady = false;
    state = emptyTaskbarState();
    render(true);
  };
  const onNavigation = (
    _event: unknown,
    _url: string,
    isInPlace: boolean,
    isMainFrame: boolean
  ) => {
    if (isMainFrame && !isInPlace) resetState();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelRetry();
    cancelReadiness();
    if (createdMessageHooked && createdMessage !== null && !window.isDestroyed()) {
      try {
        window.unhookWindowMessage(createdMessage);
      } catch {
        // Closing native window.
      }
    }
    try {
      preview?.dispose();
    } catch {
      // Native cleanup must not leave renderer/theme listeners attached.
    }
    preview = undefined;
    nativeTheme.removeListener('updated', onTheme);
    ipcMain.removeListener(TASKBAR_STATE_CHANNEL, onState);
    ipcMain.removeListener('update-play-state', onPlaying);
    window.removeListener('ready-to-show', onReady);
    window.removeListener('show', onShow);
    window.removeListener('hide', onHide);
    window.removeListener('focus', onReady);
    window.removeListener('restore', onReady);
    window.removeListener('closed', dispose);
    contents.removeListener('did-finish-load', onReady);
    contents.removeListener('did-start-navigation', onNavigation);
    contents.removeListener('render-process-gone', resetState);
  };

  ipcMain.on(TASKBAR_STATE_CHANNEL, onState);
  nativeTheme.on('updated', onTheme);
  ipcMain.on('update-play-state', onPlaying);
  try {
    createdMessage = getCreatedMessage();
    if (createdMessage !== null && !window.isWindowMessageHooked(createdMessage)) {
      window.hookWindowMessage(createdMessage, onCreated);
      createdMessageHooked = true;
      windowHidden = !window.isVisible() && !window.isMinimized();
      taskbarReady = !windowHidden;
    }
  } catch {
    // Preserve the event/retry fallback if the native readiness hook is unavailable.
  }
  window.on('ready-to-show', onReady);
  window.on('show', onShow);
  window.on('hide', onHide);
  window.on('focus', onReady);
  window.on('restore', onReady);
  window.once('closed', dispose);
  contents.on('did-finish-load', onReady);
  contents.on('did-start-navigation', onNavigation);
  contents.on('render-process-gone', resetState);
  render(true);
  return dispose;
}
