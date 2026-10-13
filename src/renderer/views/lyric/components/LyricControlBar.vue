<template>
  <div class="control-bar" :class="{ show: showControls }">
    <div class="control-bar__left">
      <span class="music-icon">♪</span>
      <span class="song-name">{{ songName }}</span>
    </div>
    <div class="control-bar__center">
      <button class="ctrl-btn ctrl-display" title="显示模式" @click="$emit('cycle-display-mode')">
        <i :class="displayModeIcon"></i>
      </button>
      <button class="ctrl-btn ctrl-font" title="字体缩小" @click="$emit('decrease-font')">
        <span class="skip-label">A-</span>
      </button>
      <button class="ctrl-btn ctrl-font" title="字体放大" @click="$emit('increase-font')">
        <span class="skip-label">A+</span>
      </button>
      <button
        class="ctrl-btn ctrl-translate"
        title="翻译"
        :class="{ active: showTranslation }"
        @click="$emit('toggle-translation')"
      >
        <i class="ri-translate-2"></i>
      </button>
      <button class="ctrl-btn ctrl-theme" title="主题" @click="$emit('toggle-theme')">
        <i :class="theme === 'light' ? 'ri-moon-line' : 'ri-sun-line'"></i>
      </button>
      <span class="ctrl-divider"></span>
      <button class="ctrl-btn ctrl-skip" title="快退 0.5s" @click="$emit('skip-backward')">
        <span class="skip-label">-0.5s</span>
      </button>
      <button class="ctrl-btn" @click="$emit('prev')">
        <i class="ri-skip-back-fill"></i>
      </button>
      <button class="ctrl-btn play-btn" @click="$emit('play-pause')">
        <i :class="isPlay ? 'ri-pause-fill' : 'ri-play-fill'"></i>
      </button>
      <button class="ctrl-btn" @click="$emit('next')">
        <i class="ri-skip-forward-fill"></i>
      </button>
      <button class="ctrl-btn ctrl-skip" title="快进 0.5s" @click="$emit('skip-forward')">
        <span class="skip-label">+0.5s</span>
      </button>
    </div>
    <div class="control-bar__right">
      <button class="ctrl-btn lock-action" @click="$emit('update:isLock')">
        <i :class="isLocked ? 'ri-lock-line' : 'ri-lock-unlock-line'"></i>
      </button>
      <button class="ctrl-btn lock-action" @click="$emit('close')">
        <i class="ri-close-line"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  showControls: boolean;
  isLocked: boolean;
  songName: string;
  isPlay: boolean;
  displayMode: 'scroll' | 'single' | 'double';
  showTranslation: boolean;
  theme: 'light' | 'dark';
}

const props = defineProps<Props>();

defineEmits<{
  'play-pause': [];
  prev: [];
  next: [];
  'update:isLock': [];
  close: [];
  'skip-forward': [];
  'skip-backward': [];
  'cycle-display-mode': [];
  'increase-font': [];
  'decrease-font': [];
  'toggle-translation': [];
  'toggle-theme': [];
}>();

const displayModeIcon = computed(() => {
  switch (props.displayMode) {
    case 'scroll':
      return 'ri-align-justify';
    case 'single':
      return 'ri-subtract-line';
    case 'double':
      return 'ri-layout-row-line';
  }
});
</script>

<style lang="scss" scoped>
.control-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  z-index: 10;
  opacity: 1;
  transition: opacity 0.25s ease;

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__center {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 2px;
  }
}

.music-icon {
  font-size: 16px;
  color: var(--highlight-color, var(--accent-color));
}

.song-name {
  font-size: 13px;
  color: var(--highlight-color, var(--accent-color));
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ctrl-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}

.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
  font-size: 18px;
  padding: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  &.active {
    color: var(--highlight-color, var(--accent-color));
  }

  .skip-label {
    font-size: 11px;
    font-weight: 500;
  }
}

.light .ctrl-btn {
  color: rgba(0, 0, 0, 0.6);

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #000;
  }

  &.active {
    color: var(--highlight-color, var(--accent-color));
  }
}

.light .ctrl-divider {
  background: rgba(0, 0, 0, 0.15);
}
</style>
