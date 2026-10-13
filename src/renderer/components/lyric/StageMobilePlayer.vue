<template>
  <teleport to="body">
    <transition name="stage-mobile-fade">
      <div
        v-if="isVisible"
        class="stage-mobile-player"
        :style="{
          '--accent-color': accentColor,
          '--accent-color-rgb': accentColorRgb,
          background: backgroundColor,
        }"
        @click="handleTapToggle"
      >
        <!-- 顶部：歌名 + 歌手 -->
        <div class="song-header" :class="{ 'song-header-visible': controlsVisible }">
          <div class="song-header-title">{{ songTitle }}</div>
          <div class="song-header-artist">
            <span v-for="(item, index) in artistList" :key="index">
              {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
            </span>
          </div>
        </div>

        <!-- 中央：歌词 + 翻译 -->
        <div class="lyrics-center">
          <transition name="lyric-change" mode="out-in">
            <div :key="nowIndex" class="lyrics-main" :style="lyricStyle">
              {{ currentLyricText }}
            </div>
          </transition>
          <transition name="translation-fade">
            <div v-if="currentTranslation" class="lyrics-translation">
              {{ currentTranslation }}
            </div>
          </transition>
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
              <div class="ctrl-btn small" @click="openPlaylist">
                <i class="ri-list-check"></i>
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
 * StageMobilePlayer — 舞台模式手机端变体
 *
 * 设计来源：code (6).html — Lyrics View
 * - 深色背景 + 居中大字歌词
 * - 顶部歌名（serif）+ 歌手
 * - 中央歌词（Cormorant Garamond, clamp 32-56px）
 * - 下方翻译（clamp 14-18px, 300 weight）
 * - 音频响应：高潮时文字使用强调色
 */
import { computed } from 'vue';

import { artistList, lrcArray, nowIndex, playMusic } from '@/hooks/MusicHook';
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
const { primaryColor, primaryColorRgb, averageColor } = useCoverColor();

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

// ==================== 歌曲信息 ====================

const songTitle = computed(() => playMusic.value?.name || '');
const accentColor = computed(() => primaryColor.value || '#888888');
const accentColorRgb = computed(() => primaryColorRgb.value || '136, 136, 136');

// ==================== 歌词 ====================

const currentLyricText = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) return '';
  return lrcArray.value[idx]?.text || '';
});

const currentTranslation = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) return '';
  return (lrcArray.value[idx] as any)?.trText || '';
});

// ==================== 音频响应 ====================

/**
 * 歌词颜色：高潮时切换为强调色
 */
const lyricColor = computed(() => {
  if (styleEngine.isInClimax) return accentColor.value;
  return '#f0ece4';
});

/**
 * 歌词字号：根据能量水平微调
 * 基础 clamp(32px, 5vw, 56px)，高能量时略大
 */
const lyricStyle = computed(() => ({
  color: lyricColor.value,
  fontSize: 'clamp(32px, 5vw, 56px)',
}));

/**
 * 背景：高潮时使用强调色的深色变体
 */
const backgroundColor = computed(() => {
  if (styleEngine.isInClimax) {
    // 高潮时背景微微偏向强调色
    return `rgba(${accentColorRgb.value}, 0.08)`;
  }
  return '#1a1a1a';
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

function openPlaylist() {
  playerStore.setPlayListDrawerVisible(true);
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
.stage-mobile-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  background: #1a1a1a;
  color: #f0ece4;
}

/* 顶部：歌名 + 歌手 */
.song-header {
  position: absolute;
  top: calc(var(--safe-area-inset-top, 0px) + 24px);
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s var(--m-ease-out, ease);

  &.song-header-visible {
    opacity: 1;
  }
}

.song-header-title {
  font-family: var(--m-font-serif, 'Cormorant Garamond', serif);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.song-header-artist {
  font-size: 12px;
  color: #666;
  margin-top: 2px;
}

/* 中央：歌词 + 翻译 */
.lyrics-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 20px;
  max-width: 800px;
}

.lyrics-main {
  font-family: var(--m-font-serif, 'Cormorant Garamond', serif);
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.01em;
  transition: color 0.3s var(--m-ease-out, ease);
  will-change: color;
}

.lyrics-translation {
  font-size: clamp(14px, 2vw, 18px);
  color: #666;
  margin-top: 16px;
  font-weight: 300;
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
    color: #f0ece4;
    background: rgba(255, 255, 255, 0.08);
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
    color: #666;
    flex-shrink: 0;
    min-width: 36px;
  }

  .progress-bar-bg {
    flex: 1;
    height: 2px;
    background: #333;
    border-radius: 1px;
    position: relative;
    cursor: pointer;

    .progress-bar-fill {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      background: #888;
      border-radius: 1px;
      transition: width 0.1s linear;
    }
  }
}

.control-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;

  .ctrl-btn {
    @apply flex items-center justify-center;
    @apply rounded-full;
    @apply cursor-pointer;
    background: #444;
    width: 42px;
    height: 42px;
    transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);

    i {
      font-size: 18px;
      color: #f0ece4;
    }

    &:active {
      transform: scale(0.97);
    }

    &.play-btn {
      width: 52px;
      height: 52px;
      background: #666;

      i {
        font-size: 24px;
      }
    }

    &.small {
      width: 36px;
      height: 36px;

      i {
        font-size: 16px;
      }
    }
  }
}

/* 歌词切换过渡 */
.lyric-change-enter-active,
.lyric-change-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease),
              transform 0.3s var(--m-ease-out, ease);
}

.lyric-change-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.lyric-change-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.translation-fade-enter-active,
.translation-fade-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease);
}

.translation-fade-enter-from,
.translation-fade-leave-to {
  opacity: 0;
}

/* 过渡动画 */
.stage-mobile-fade-enter-active,
.stage-mobile-fade-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease);
}

.stage-mobile-fade-enter-from,
.stage-mobile-fade-leave-to {
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
  .lyric-change-enter-active,
  .lyric-change-leave-active,
  .translation-fade-enter-active,
  .translation-fade-leave-active,
  .stage-mobile-fade-enter-active,
  .stage-mobile-fade-leave-active,
  .ctrl-fade-enter-active,
  .ctrl-fade-leave-active {
    transition: opacity 0.2s ease;
  }

  .lyrics-main {
    transition: none;
  }
}
</style>
