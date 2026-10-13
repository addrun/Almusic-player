<template>
  <teleport to="body">
    <transition name="magazine-mobile-fade">
      <div
        v-if="isVisible"
        class="magazine-mobile-player"
        :style="{
          '--block-color-0': blockColors[0] || accentColor,
          '--block-color-1': blockColors[1] || accentColor,
          '--block-color-2': blockColors[2] || averageColor,
          '--block-color-3': blockColors[3] || accentColor,
          '--block-color-4': blockColors[4] || averageColor,
        }"
        @click="handleTapToggle"
      >
        <!-- 左侧色块区域 -->
        <div class="left-blocks">
          <!-- 歌手名色块 -->
          <div
            class="color-block text-block"
            :style="{
              backgroundColor: 'var(--block-color-0)',
              height: blockHeights[0] + 'px',
            }"
          >
            <span class="block-label">{{ artistName }}</span>
          </div>

          <!-- 歌名色块 -->
          <div
            class="color-block text-block"
            :style="{
              backgroundColor: 'var(--block-color-1)',
              height: blockHeights[1] + 'px',
            }"
          >
            <span class="block-label">{{ songTitle }}</span>
          </div>

          <!-- 装饰色块 -->
          <div
            v-for="i in 3"
            :key="'decor-' + i"
            class="color-block decor-block"
            :style="{
              backgroundColor: `var(--block-color-${i + 1})`,
              height: blockHeights[i + 1] + 'px',
            }"
          ></div>
        </div>

        <!-- 右侧区域 -->
        <div class="right-area">
          <!-- 歌词区 -->
          <div class="lyrics-area" ref="lyricsScrollRef">
            <div
              v-for="(line, index) in visibleLyrics"
              :key="index"
              class="lyric-line"
              :class="{ active: index === activeLyricOffset }"
            >
              {{ line.text }}
            </div>
          </div>

          <!-- 底部控件 -->
          <transition name="ctrl-fade">
            <div v-show="controlsVisible" class="bottom-controls no-toggle">
              <!-- 进度条 -->
              <div class="progress-row">
                <span class="time-text">{{ formatTime(currentTime) }}</span>
                <div class="progress-bar-bg" @click="handleSeek">
                  <div
                    class="progress-bar-fill"
                    :style="{ width: progressPercent + '%' }"
                  ></div>
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

          <!-- 顶部控件 -->
          <transition name="ctrl-fade">
            <div v-show="controlsVisible" class="top-controls no-toggle">
              <div class="ctrl-btn close-btn" @click="close">
                <i class="ri-arrow-down-s-line"></i>
              </div>
              <div class="ctrl-btn" @click="cycleStyle">
                <i class="ri-shuffle-line"></i>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { extractRegionalColors, useCoverColor } from '@/hooks/useCoverColor';
import { artistList, lrcArray, nowIndex, playMusic } from '@/hooks/MusicHook';
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

// 歌曲信息
const artistName = computed(() => {
  const artists = artistList.value;
  if (!artists || artists.length === 0) return '';
  return artists.map((a: any) => a.name).join(' / ');
});

const songTitle = computed(() => playMusic.value?.name || '');
const accentColor = computed(() => primaryColor.value || '#888888');

// ==================== 色块颜色 ====================

const blockColors = ref<string[]>([]);

// 切歌时重新提取区域颜色
watch(
  () => playMusic.value?.picUrl,
  async (picUrl) => {
    if (!picUrl) {
      blockColors.value = [];
      return;
    }
    blockColors.value = await extractRegionalColors(picUrl, 5);
  },
  { immediate: true }
);

// ==================== 音频响应色块高度 ====================

/**
 * 每个色块绑定不同的音频特征，产生差异化伸缩效果：
 * - 块 0 (歌手名): energyLevel → 整体能量
 * - 块 1 (歌名): kickEnergy → 鼓点能量
 * - 块 2 (装饰): beatFlux → 频谱通量
 * - 块 3 (装饰): energyLevel + kickEnergy 混合
 * - 块 4 (装饰): isBeat 脉冲
 */
const blockHeights = computed(() => {
  const base = 50;
  const max = 200;
  const energy = styleEngine.energyLevel || 0;
  const kick = styleEngine.kickEnergy || 0;
  const flux = Math.min(1, (styleEngine.beatFlux || 0) / 10);
  const beatPulse = styleEngine.isBeat ? 1 : 0.3;

  return [
    base + (max - base) * energy,           // 块 0: energy
    base + (max - base) * kick,             // 块 1: kick
    base + (max - base) * flux,             // 块 2: flux
    base + (max - base) * ((energy + kick) / 2), // 块 3: 混合
    base + (max - base) * beatPulse,       // 块 4: beat pulse
  ];
});

// ==================== 歌词显示 ====================

const lyricsScrollRef = ref<HTMLElement | null>(null);

// 显示当前行前后各 2 行（共 5 行）
const activeLyricOffset = ref(2); // 当前在可见区域的中间

const visibleLyrics = computed(() => {
  const lyrics = lrcArray.value;
  const idx = nowIndex.value;
  if (!lyrics || lyrics.length === 0) return [];

  const start = Math.max(0, idx - 2);
  const end = Math.min(lyrics.length, idx + 3);
  const result = lyrics.slice(start, end);

  // 如果起始位置被截断，需要调整偏移
  activeLyricOffset.value = idx - start;
  return result;
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
  // 触发样式切换事件
  window.dispatchEvent(new CustomEvent('music-full-config-updated'));
}

// ==================== 工具函数 ====================

function formatTime(seconds: number): string {
  return secondToMinute(seconds);
}

// ==================== 生命周期 ====================

onMounted(() => {
  // 非移动端也支持，但默认隐藏控件
});

onBeforeUnmount(() => {
  // 清理
});
</script>

<style lang="scss" scoped>
.magazine-mobile-player {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  overflow: hidden;
  background: #1a1a1a;
  color: #f0ece4;
}

.left-blocks {
  width: 35%;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;

  .color-block {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: height 0.1s ease-out;
    flex-shrink: 0;

    &.text-block {
      .block-label {
        font-family: var(--m-font-serif, 'Cormorant Garamond', serif);
        font-weight: 600;
        font-size: clamp(12px, 2.5vw, 16px);
        color: rgba(255, 255, 255, 0.9);
        text-align: center;
        padding: 0 8px;
        word-break: break-word;
        line-height: 1.2;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        max-height: 90%;
        overflow: hidden;
      }
    }

    &.decor-block {
      /* 装饰色块无文字 */
    }
  }
}

.right-area {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 24px 20px;
  overflow: hidden;
}

/* 歌词区 */
.lyrics-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14px;
  overflow: hidden;

  .lyric-line {
    font-size: clamp(14px, 2vw, 16px);
    color: #666;
    transition: all 0.3s;
    text-align: left;
    line-height: 1.4;

    &.active {
      color: #f0ece4;
      font-size: clamp(16px, 2.5vw, 20px);
      font-weight: 600;
    }
  }
}

/* 底部控件 */
.bottom-controls {
  flex-shrink: 0;
  padding-top: 16px;
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
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #444;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;

    i {
      font-size: 18px;
      color: #f0ece4;
    }

    &:active {
      background: #555;
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

/* 顶部控件 */
.top-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 16px 12px;

  .ctrl-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    i {
      font-size: 18px;
      color: #f0ece4;
    }
  }
}

/* 过渡动画 */
.magazine-mobile-fade-enter-active,
.magazine-mobile-fade-leave-active {
  transition: opacity 0.3s ease;
}

.magazine-mobile-fade-enter-from,
.magazine-mobile-fade-leave-to {
  opacity: 0;
}

.ctrl-fade-enter-active,
.ctrl-fade-leave-active {
  transition: opacity 0.2s ease;
}

.ctrl-fade-enter-from,
.ctrl-fade-leave-to {
  opacity: 0;
}
</style>
