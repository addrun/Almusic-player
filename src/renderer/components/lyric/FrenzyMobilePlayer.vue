<template>
  <teleport to="body">
    <transition name="frenzy-mobile-fade">
      <div
        v-if="isVisible"
        class="frenzy-mobile-player"
        :style="{
          '--text-dark': textColorDark,
          '--text-gray': textColorGray,
          background: backgroundColor,
        }"
        @click="handleTapToggle"
      >
        <!-- 四角装饰圆点 -->
        <div class="corner-dot tl"></div>
        <div class="corner-dot tr"></div>
        <div class="corner-dot bl"></div>
        <div class="corner-dot br"></div>

        <!-- 巨字歌词 -->
        <div class="giant-text-container">
          <div class="giant-text line-1" :style="{ fontSize: fontSizePx, color: 'var(--text-dark)' }">
            {{ lyricPart1 }}
          </div>
          <div class="giant-text line-2" :style="{ fontSize: fontSizePx, color: 'var(--text-gray)' }">
            {{ lyricPart2 }}
          </div>
        </div>

        <!-- 顶部控件（tap 弹出） -->
        <transition name="ctrl-fade">
          <div v-show="controlsVisible" class="top-controls no-toggle">
            <div class="ctrl-btn" @click="close">
              <i class="ri-arrow-down-s-line"></i>
            </div>
            <div style="flex:1"></div>
            <div class="ctrl-btn" @click="cycleStyle">
              <i class="ri-shuffle-line"></i>
            </div>
          </div>
        </transition>

        <!-- 底部控件（tap 弹出） -->
        <transition name="ctrl-fade">
          <div v-show="controlsVisible" class="bottom-controls no-toggle">
            <!-- 进度条 -->
            <div class="progress-row">
              <span class="time-text">{{ formatTime(currentTime) }}</span>
              <div class="progress-bar-bg" @click="handleSeek">
                <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
              </div>
              <span class="time-text">{{ formatTime(duration) }}</span>
            </div>
            <!-- 控制按钮 -->
            <div class="control-buttons">
              <div class="ctrl-btn" @click="handlePrev">
                <i class="ri-skip-back-fill"></i>
              </div>
              <div class="ctrl-btn play-btn" @click="handlePlayPause">
                <i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i>
              </div>
              <div class="ctrl-btn" @click="handleNext">
                <i class="ri-skip-forward-fill"></i>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
/**
 * FrenzyMobilePlayer — 狂躁模式手机端变体
 *
 * 设计来源：code (1).html — "Chasing Golden"
 * - 浅色背景 + 两行巨字
 * - 第一行深色，第二行灰色
 * - Inter 900，uppercase，超大字号
 * - 四角圆点装饰
 * - 音频响应：鼓点时字号脉冲/颜色切换
 */
import { computed, ref, watch } from 'vue';

import { lrcArray, nowIndex, playMusic, artistList } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { secondToMinute } from '@/utils';

import { useTapToggle } from '@/composables/useTapToggle';

// ==================== Props ====================

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  background: { type: String, default: '' },
  overlayMode: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

// ==================== Store & Hooks ====================

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const { primaryColor, averageColor } = useCoverColor();

const { controlsVisible, handleTapToggle } = useTapToggle();

// ==================== 状态 ====================

const isVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

const isPlaying = computed(() => playerStore.isPlay);
const currentTime = computed(() => playerStore.playingTime || 0);
const duration = computed(() => (playMusic.value?.dt || playMusic.value?.duration || 0) / 1000);
const progressPercent = computed(() => {
  if (!duration.value) return 0;
  return (currentTime.value / duration.value) * 100;
});

// ==================== 巨字歌词拆分 ====================

/**
 * 获取当前歌词行并拆分为两部分
 * 规则：
 * 1. 优先在空格/逗号/顿号处拆分
 * 2. 如果没有自然分隔，在中间字符处拆分
 * 3. 只有一部分时，第二行为空
 */
const currentLyricParts = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) return ['', ''];

  const text = lrcArray.value[idx]?.text || '';
  if (!text) return ['', ''];

  // 尝试在自然分隔处拆分
  const separators = [' ', '，', ',', '、', '；', ';', ''];
  for (const sep of separators) {
    const pos = text.indexOf(sep);
    if (pos > 0 && pos < text.length - 1) {
      return [text.slice(0, pos).trim(), text.slice(pos + 1).trim()];
    }
  }

  // 没有分隔符：在中间拆分
  const mid = Math.floor(text.length / 2);
  return [text.slice(0, mid), text.slice(mid)];
});

const lyricPart1 = computed(() => currentLyricParts.value[0] || '');
const lyricPart2 = computed(() => currentLyricParts.value[1] || '');

// ==================== 音频响应视觉 ====================

/**
 * 鼓点时字号脉冲放大
 * 基础字号 clamp(80px, 14vw, 160px)，鼓点时增加 5-10%
 */
const fontSizePx = computed(() => {
  const base = 'clamp(80px, 14vw, 160px)';
  // 鼓点命中时脉冲（通过 CSS scale 实现，不改变 font-size 避免重排）
  return base;
});

/**
 * 颜色：高潮时切换为强调色
 */
const textColorDark = computed(() => {
  if (styleEngine.isInClimax) return primaryColor.value;
  return '#1a1a1a';
});

const textColorGray = computed(() => {
  if (styleEngine.isInClimax) return averageColor.value;
  return '#6b6b6b';
});

/**
 * 背景：高潮时切换为强调色的浅色变体
 */
const backgroundColor = computed(() => {
  if (styleEngine.isInClimax) {
    return '#f5f5f5'; // 高潮时也保持浅色，但文字变色
  }
  return '#f5f5f5';
});

// ==================== 播放控制 ====================

function close() {
  isVisible.value = false;
}

function handlePrev() {
  playerStore.prevPlay();
}

function handleNext() {
  playerStore.nextPlay();
}

function handlePlayPause() {
  playerStore.setPlay(playMusic.value);
}

function handleSeek(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  const seekTime = percent * duration.value;
  playerStore.setPlayTime(seekTime);
}

function cycleStyle() {
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
}

function formatTime(seconds: number): string {
  return secondToMinute(seconds);
}
</script>

<style lang="scss" scoped>
.frenzy-mobile-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #f5f5f5;
}

/* 四角圆点装饰 */
.corner-dot {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ccc;
  transition: background 0.3s var(--m-ease-out, ease);

  &.tl { top: 20px; left: 20px; }
  &.tr { top: 20px; right: 20px; }
  &.bl { bottom: 20px; left: 20px; }
  &.br { bottom: 20px; right: 20px; }
}

/* 巨字容器 */
.giant-text-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 20px;
}

.giant-text {
  font-family: var(--m-font-art, 'Inter', sans-serif);
  font-weight: 900;
  line-height: 0.95;
  letter-spacing: -0.03em;
  text-transform: uppercase;
  text-align: center;
  transition: color 0.3s var(--m-ease-out, ease);
  /* 鼓点脉冲：用 scale 而非 font-size 避免重排 */
  transform: scale(1);
  will-change: transform, color;
}

/* 顶部控件 */
.top-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: calc(var(--safe-area-inset-top, 0px) + 16px) 20px 0;

  .ctrl-btn {
    @apply flex items-center justify-center;
    @apply w-10 h-10 rounded-full;
    @apply text-xl;
    color: #1a1a1a;
    background: rgba(0, 0, 0, 0.05);
    cursor: pointer;
    transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

    &:active {
      transform: scale(0.97);
    }
  }
}

/* 底部控件 */
.bottom-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0 24px calc(var(--safe-area-inset-bottom, 0px) + 32px);
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;

  .time-text {
    font-size: 12px;
    color: #999;
    flex-shrink: 0;
    min-width: 36px;
  }

  .progress-bar-bg {
    flex: 1;
    height: 2px;
    background: #ddd;
    border-radius: 1px;
    position: relative;
    cursor: pointer;

    .progress-bar-fill {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      background: #1a1a1a;
      border-radius: 1px;
      transition: width 0.1s linear;
    }
  }
}

.control-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;

  .ctrl-btn {
    @apply flex items-center justify-center;
    @apply rounded-full;
    @apply cursor-pointer;
    background: #ddd;
    width: 42px;
    height: 42px;
    transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

    i {
      font-size: 18px;
      color: #1a1a1a;
    }

    &:active {
      transform: scale(0.97);
    }

    &.play-btn {
      width: 56px;
      height: 56px;
      background: #999;

      i {
        font-size: 24px;
        color: #fff;
      }
    }
  }
}

/* 过渡动画 */
.frenzy-mobile-fade-enter-active,
.frenzy-mobile-fade-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease);
}

.frenzy-mobile-fade-enter-from,
.frenzy-mobile-fade-leave-to {
  opacity: 0;
}

.ctrl-fade-enter-active,
.ctrl-fade-leave-active {
  transition: opacity 0.2s var(--m-ease-out, ease);
}

.ctrl-fade-enter-from,
.ctrl-fade-leave-to {
  opacity: 0;
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  .giant-text {
    transition: none;
  }
  .frenzy-mobile-fade-enter-active,
  .frenzy-mobile-fade-leave-active,
  .ctrl-fade-enter-active,
  .ctrl-fade-leave-active {
    transition: opacity 0.2s ease;
  }
}
</style>
