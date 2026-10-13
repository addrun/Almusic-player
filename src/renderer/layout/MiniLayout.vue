<!-- 迷你模式布局 -->
<template>
  <div
    class="mini-layout"
    :class="{ 'mini-mode': settingsStore.isMiniMode }"
    @mousedown="drag"
  >
    <!-- 拖拽区域 + 恢复按钮 -->
    <div class="mini-header">
      <div class="mini-drag-zone" @mousedown="drag"></div>
      <div class="mini-actions">
        <div class="mini-action-btn" title="恢复窗口" @click="restoreWindow">
          <i class="ri-fullscreen-line"></i>
        </div>
        <div class="mini-action-btn mini-action-btn--close" title="关闭" @click="closeWindow">
          <i class="ri-close-line"></i>
        </div>
      </div>
    </div>

    <!-- 播放栏 -->
    <mini-play-bar />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';

import MiniPlayBar from '@/components/player/MiniPlayBar.vue';

const settingsStore = useSettingsStore();

onMounted(() => {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
});

const restoreWindow = () => {
  if (!isElectron) return;
  window.api.restore();
};

const closeWindow = () => {
  if (!isElectron) return;
  window.api.miniTray();
};

const drag = (event: MouseEvent) => {
  if (!isElectron) return;
  window.api.dragStart(event as unknown as string);
};
</script>

<style lang="scss" scoped>
.mini-layout {
  @apply w-full h-full flex flex-col;
  background: #f5f5f5;
  overflow: hidden;
  border-radius: 8px;
}

.dark .mini-layout {
  background: #1a1a1a;
}

.mini-header {
  display: flex;
  align-items: center;
  height: 20px;
  flex-shrink: 0;
  position: relative;
}

.mini-drag-zone {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
  cursor: grab;
}

.mini-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 4px;
  -webkit-app-region: no-drag;
  z-index: 1;
}

.mini-action-btn {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--text-color-200, #999);
  font-size: 11px;

  &:hover {
    background: rgba(0, 0, 0, 0.1);
    color: var(--accent-color, #888);
  }

  .dark & {
    color: #666;
    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ccc;
    }
  }
}

.mini-action-btn--close:hover {
  background: #ef4444 !important;
  color: #fff !important;
}
</style>
