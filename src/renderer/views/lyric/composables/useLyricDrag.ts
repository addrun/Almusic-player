import type { Ref } from 'vue';
import { onUnmounted,ref } from 'vue';

import type { LyricSettings } from './useLyricSettings';

const windowData = window as any;

export function useLyricDrag(lyricSetting: Ref<LyricSettings>) {
  const isDragging = ref(false);
  const moveThrottleMs = 10;

  let startPosition = { x: 0, y: 0 };
  let lastMoveTime = 0;

  const handleMouseDown = (e: MouseEvent) => {
    if (
      lyricSetting.value.isLock ||
      (e.target as HTMLElement).closest('.control-buttons') ||
      (e.target as HTMLElement).closest('.font-size-controls') ||
      (e.target as HTMLElement).closest('.play-controls')
    ) {
      return;
    }
    if (e.button !== 0) return;

    isDragging.value = true;
    startPosition = { x: e.screenX, y: e.screenY };
    lastMoveTime = performance.now();

    windowData.electron.ipcRenderer.send('lyric-drag-start');

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.value) return;

      const now = performance.now();
      if (now - lastMoveTime < moveThrottleMs) return;
      lastMoveTime = now;

      const deltaX = e.screenX - startPosition.x;
      const deltaY = e.screenY - startPosition.y;

      if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
        windowData.electron.ipcRenderer.send('lyric-drag-move', { deltaX, deltaY });
        startPosition = { x: e.screenX, y: e.screenY };
      }
    };

    const handleMouseUp = () => {
      if (!isDragging.value) return;
      isDragging.value = false;

      windowData.electron.ipcRenderer.send('lyric-drag-end');

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  onUnmounted(() => {
    isDragging.value = false;
  });

  return {
    handleMouseDown,
    isDragging
  };
}
