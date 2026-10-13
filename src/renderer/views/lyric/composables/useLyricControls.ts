import type { Ref } from 'vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';

import type { LyricSettings } from './useLyricSettings';

const windowData = window as any;

const isMac = navigator.platform?.includes('Mac') ?? false;

function formatShortcutForDisplay(accelerator: string): string {
  return accelerator
    .split('+')
    .map((seg) => {
      const s = seg.toLowerCase();
      if (s === 'commandorcontrol' || s === 'ctrl' || s === 'cmd' || s === 'meta') {
        return isMac ? 'Cmd' : 'Ctrl';
      }
      if (s === 'alt' || s === 'option') return isMac ? 'Option' : 'Alt';
      if (s === 'shift') return 'Shift';
      return seg;
    })
    .join('+');
}

export function useLyricControls(lyricSetting: Ref<LyricSettings>) {
  const isHovering = ref(false);
  const unlockShortcut = ref('CommandOrControl+L');

  const unlockShortcutDisplay = computed(() => formatShortcutForDisplay(unlockShortcut.value));

  const showControls = computed(() => !lyricSetting.value.isLock);

  const handleMouseEnter = () => {
    isHovering.value = true;
  };

  const handleMouseLeave = () => {
    isHovering.value = false;
  };

  const handlePlayPause = () => {
    windowData.electron.ipcRenderer.send('control-back', 'playpause');
  };

  const handlePrev = () => {
    windowData.electron.ipcRenderer.send('control-back', 'prev');
  };

  const handleNext = () => {
    windowData.electron.ipcRenderer.send('control-back', 'next');
  };

  const handleLock = () => {
    lyricSetting.value.isLock = !lyricSetting.value.isLock;
    isHovering.value = false;
    windowData.electron.ipcRenderer.send('set-ignore-mouse', lyricSetting.value.isLock);
    windowData.electron.ipcRenderer.send('set-lock-state', lyricSetting.value.isLock);
  };

  const handleClose = () => {
    windowData.electron.ipcRenderer.send('close-lyric');
  };

  const skipForward = () => {
    windowData.electron.ipcRenderer.send('control-back', 'seek-forward');
  };

  const skipBackward = () => {
    windowData.electron.ipcRenderer.send('control-back', 'seek-backward');
  };

  const cycleDisplayMode = () => {
    const modes: Array<'scroll' | 'single' | 'double'> = ['scroll', 'single', 'double'];
    const current = modes.indexOf(lyricSetting.value.displayMode);
    lyricSetting.value.displayMode = modes[(current + 1) % modes.length];
  };

  const toggleTranslation = () => {
    lyricSetting.value.showTranslation = !lyricSetting.value.showTranslation;
  };

  const checkTheme = () => {
    lyricSetting.value.theme = lyricSetting.value.theme === 'light' ? 'dark' : 'light';
  };

  const hoverStateHandler = (_: any, hovering: boolean) => {
    isHovering.value = hovering;
  };

  const shortcutHandler = (_: any, shortcut: string) => {
    unlockShortcut.value = shortcut;
  };

  const unlockHandler = () => {
    if (lyricSetting.value.isLock) {
      handleLock();
    }
  };

  onMounted(() => {
    if (lyricSetting.value.isLock) {
      isHovering.value = false;
      windowData.electron.ipcRenderer.send('set-ignore-mouse', true);
      windowData.electron.ipcRenderer.send('set-lock-state', true);
    }

    windowData.electron.ipcRenderer.on('lyric-hover-state', hoverStateHandler);
    windowData.electron.ipcRenderer.on('receive-lyric-shortcut', shortcutHandler);
    windowData.electron.ipcRenderer.on('lyric-unlock', unlockHandler);
  });

  onUnmounted(() => {
    windowData.electron.ipcRenderer.removeListener('lyric-hover-state', hoverStateHandler);
    windowData.electron.ipcRenderer.removeListener('receive-lyric-shortcut', shortcutHandler);
    windowData.electron.ipcRenderer.removeListener('lyric-unlock', unlockHandler);
  });

  return {
    isHovering,
    unlockShortcutDisplay,
    showControls,
    handleMouseEnter,
    handleMouseLeave,
    handlePlayPause,
    handlePrev,
    handleNext,
    handleLock,
    handleClose,
    skipForward,
    skipBackward,
    cycleDisplayMode,
    toggleTranslation,
    checkTheme
  };
}
