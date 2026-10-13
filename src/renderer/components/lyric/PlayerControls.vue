<template>
  <!-- 左上角：关闭按钮 -->
  <transition v-if="!hideClose" name="controls-fade">
    <div v-show="visible" class="player-controls__left" :class="'theme-' + theme">
      <div class="player-controls__btn" @click="$emit('close')" :title="closeTitle">
        <i class="ri-arrow-down-s-line"></i>
      </div>
    </div>
  </transition>

  <!-- 右上角：设置 + 模式切换 + 额外按钮 + 全屏 -->
  <transition name="controls-fade">
    <div v-show="visible" class="player-controls__right" :class="'theme-' + theme">
      <n-popover v-if="!hideSettings" trigger="click" placement="bottom-end" :z-index="99999" raw to="body">
        <template #trigger>
          <div class="player-controls__btn">
            <i class="ri-settings-3-line"></i>
          </div>
        </template>
        <lyric-settings />
      </n-popover>
      <div
        v-if="showStyleSwitch"
        class="player-controls__btn"
        @click="$emit('cycleStyle')"
        :title="styleLabel"
      >
        <i :class="styleIcon"></i>
      </div>
      <!-- 额外按钮插槽（如颜色反转、高潮模式等） -->
      <slot name="extra" />
      <div class="player-controls__btn" @click="$emit('toggleFullscreen')">
        <i :class="isFullScreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'"></i>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

import LyricSettings from './LyricSettings.vue';

interface Props {
  isFullScreen?: boolean;
  styleIcon?: string;
  styleLabel?: string;
  closeTitle?: string;
  showStyleSwitch?: boolean;
  autoHide?: boolean;
  theme?: 'light' | 'dark';
  hideClose?: boolean;
  hideSettings?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isFullScreen: false,
  styleIcon: '',
  styleLabel: '',
  closeTitle: '关闭',
  showStyleSwitch: true,
  autoHide: false,
  theme: 'light',
  hideClose: false,
  hideSettings: false
});

defineEmits<{
  close: [];
  cycleStyle: [];
  toggleFullscreen: [];
}>();

// 自动隐藏逻辑（仅 autoHide 模式）
const visible = ref(!props.autoHide);
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const HIDE_DELAY = 3000;

function resetHideTimer() {
  if (!props.autoHide) return;
  if (hideTimer) clearTimeout(hideTimer);
  visible.value = true;
  hideTimer = setTimeout(() => {
    visible.value = false;
  }, HIDE_DELAY);
}

function onMouseMove() {
  if (props.autoHide) {
    resetHideTimer();
  }
}

onMounted(() => {
  if (props.autoHide) {
    document.addEventListener('mousemove', onMouseMove);
    resetHideTimer();
  }
});

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove);
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<style scoped>
.player-controls__left {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: var(--d-z-popover, 9999);
}

.player-controls__right {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: var(--d-z-popover, 9999);
  display: flex;
  gap: var(--d-space-3, 12px);
  align-items: center;
}

.player-controls__btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--d-radius-full, 50%);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: var(--d-glass-blur, blur(8px));
  -webkit-backdrop-filter: var(--d-glass-blur, blur(8px));
  cursor: pointer;
  transition: background var(--d-duration-normal, 0.2s) var(--d-ease-out, ease),
              transform var(--d-duration-fast, 0.125s) var(--d-ease-out, ease);
  color: #fff;
  font-size: 20px;
}

.theme-dark .player-controls__btn {
  background: rgba(0, 0, 0, 0.05);
  color: #1a1a1a;
}

.player-controls__btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.theme-dark .player-controls__btn:hover {
  background: rgba(0, 0, 0, 0.12);
}

.player-controls__btn:active {
  transform: scale(0.95);
}

/* 过渡动画 */
.controls-fade-enter-active,
.controls-fade-leave-active {
  transition:
    opacity var(--d-duration-slow, 0.3s) var(--d-ease-out, ease),
    transform var(--d-duration-slow, 0.3s) var(--d-ease-out, ease);
}
.controls-fade-enter-from,
.controls-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
