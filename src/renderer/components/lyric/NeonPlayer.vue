<template>
  <transition name="neon-fade">
    <div
      v-if="isVisible"
      class="neon-player"
      :class="{ 'overlay-mode': overlayMode }"
      :style="{ '--neon-color': neonColor, '--neon-bright': neonBright, '--neon-dim': neonDim }"
      @click="handleTapToggle"
    >
      <!-- 老旧墙面背景 -->
      <div class="concrete-bg" :style="{ filter: `brightness(${bgBrightness}) contrast(1.1) sepia(0.3)` }"></div>

      <!-- 泛黄覆层 -->
      <div class="aged-overlay"></div>

      <!-- 四周暗淡光效 -->
      <div class="ambient-glow" :style="{ opacity: beatGlowOpacity }"></div>

      <!-- 歌词层：逐字陈旧笔画 -->
      <div class="lyrics-layer">
        <div class="neon-lyrics" :style="{ fontSize: lyricFontSize }">
          <template v-for="(char, i) in currentChars" :key="i">
            <span v-if="char === ' '" class="neon-space">&nbsp;</span>
            <neon-stroke-char
              v-else
              :char="char"
              :color="neonColor"
              :beatSpike="beatSpike"
              :style="{ fontSize: '1em', animationDelay: i * 0.1 + 's' }"
            />
          </template>
        </div>

        <!-- 降级：笔画数据未加载时显示纯文字 -->
        <div v-if="!hasAnyStrokes && currentText" class="fallback-lyrics" :style="{ color: neonBright, textShadow: fallbackShadow }">
          {{ currentText }}
        </div>
      </div>

      <!-- 通用顶部控件 -->
      <player-controls
        v-if="!overlayMode"
        v-show="controlsVisible"
        :isFullScreen="isFullScreen"
        :showStyleSwitch="false"
        theme="dark"
        class="no-toggle"
        @close="close"
        @toggleFullscreen="toggleFullScreen"
      />
    </div>
  </transition>
</template>

<script setup lang="ts">
/**
 * NeonPlayer — 陈旧模式播放器
 *
 * - 背景：老旧墙面纹理（SVG feTurbulence 生成）+ 泛黄覆层
 * - 四周：暗淡的褪色光效，向内渐变
 * - 歌词：逐字拆笔画，SVG path 渲染为褪色老旧效果
 * - 鼓点：订阅 drumDetector，beatSpike 调制亮度/缩放
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { lrcArray, nowIndex } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { drumDetector } from '@/services/drumDetector';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { usePlayerStore } from '@/store/modules/player';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import { setCurrentSongId } from '@/utils/emotionalDetector';

import { useTapToggle } from '@/composables/useTapToggle';
import { loadDictionary, getStrokes } from '@/lib/hanziStrokes';

import NeonStrokeChar from './NeonStrokeChar.vue';
import PlayerControls from './PlayerControls.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  background: { type: String, default: '' },
  overlayMode: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

const styleEngine = useStyleEngineStore();
const playerStore = usePlayerStore();
const { primaryColor } = useCoverColor();
const { controlsVisible, handleTapToggle } = useTapToggle();

const isVisible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) });

// ==================== 响应式配置 ====================
const config = ref<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG });

function loadConfig() {
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    try {
      config.value = { ...DEFAULT_LYRIC_CONFIG, ...JSON.parse(saved) };
    } catch {
      config.value = { ...DEFAULT_LYRIC_CONFIG };
    }
  }
}
loadConfig();

function handleConfigUpdate() {
  loadConfig();
}

// ==================== 颜色 ====================
const neonUseCoverColor = computed(() => (config.value as any).neonUseCoverColor !== false);
const neonCustomColor = computed(() => (config.value as any).neonCustomColor || '#c9a96e');

const neonColor = computed(() => {
  if (neonUseCoverColor.value) return primaryColor.value || '#c9a96e';
  return neonCustomColor.value;
});

const neonBright = computed(() => {
  const rgb = neonColor.value.match(/\d+/g);
  if (!rgb) return '#e8d5a8';
  return `rgb(${Math.min(255, Number(rgb[0]) + 50)}, ${Math.min(255, Number(rgb[1]) + 50)}, ${Math.min(255, Number(rgb[2]) + 50)})`;
});

const neonDim = computed(() => {
  const rgb = neonColor.value.match(/\d+/g);
  if (!rgb) return '#5c4a2e';
  return `rgb(${Math.round(Number(rgb[0]) * 0.4)}, ${Math.round(Number(rgb[1]) * 0.4)}, ${Math.round(Number(rgb[2]) * 0.4)})`;
});

// 背景亮度配置
const bgBrightness = computed(() => {
  const val = (config.value as any).neonBackgroundBrightness ?? 25;
  return val / 100;
});

// 降级纯文字的发光阴影
const fallbackShadow = computed(() => {
  return `0 0 3px ${neonColor.value}88, 0 0 8px ${neonDim.value}66`;
});

// ==================== 鼓点检测 ====================
const beatSpike = ref(0);
const beatIntensity = computed(() => ((config.value as any).neonBeatIntensity ?? 50) / 100);
let spikeTimer: ReturnType<typeof setTimeout> | null = null;
const SPIKE_DURATION = 120; // 鼓点峰值持续 120ms

let beatUnsubscribe: (() => void) | null = null;

function subscribeDrumDetector() {
  if (beatUnsubscribe) return;
  beatUnsubscribe = drumDetector.onBeat((info) => {
    const spikeAmount = info.isStrong ? 0.6 : 0.35;
    beatSpike.value = spikeAmount * (0.5 + info.kickEnergy * 0.5) * beatIntensity.value;

    if (spikeTimer) clearTimeout(spikeTimer);
    spikeTimer = setTimeout(() => {
      beatSpike.value = 0;
    }, SPIKE_DURATION);
  });
}

function unsubscribeDrumDetector() {
  if (beatUnsubscribe) {
    beatUnsubscribe();
    beatUnsubscribe = null;
  }
  if (spikeTimer) {
    clearTimeout(spikeTimer);
    spikeTimer = null;
  }
}

// 背景光效 opacity：鼓点命中时微亮
const beatGlowOpacity = computed(() => 0.15 + beatSpike.value * 0.25);

// ==================== 歌词 ====================
const currentText = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) return '';
  return lrcArray.value[idx]?.text || '';
});

const currentChars = computed(() => Array.from(currentText.value || ''));
const lyricFontSize = computed(() => 'clamp(40px, 8vw, 80px)');

const hasAnyStrokes = ref(false);
async function checkStrokes() {
  await loadDictionary();
  for (const char of currentChars.value) {
    if (/[\u4e00-\u9fff]/.test(char)) {
      const s = getStrokes(char);
      if (s && s.length > 0) {
        hasAnyStrokes.value = true;
        return;
      }
    }
  }
  hasAnyStrokes.value = false;
}

watch(currentText, () => checkStrokes());

// ==================== 切歌时重新加载高潮数据 ====================
watch(
  () => playerStore.currentSong?.id,
  (songId) => {
    if (songId) {
      setCurrentSongId(String(songId));
      styleEngine.loadClimaxData(String(songId));
    }
  },
  { immediate: true }
);

// ==================== 生命周期 ====================
onMounted(() => {
  window.addEventListener('music-full-config-updated', handleConfigUpdate);
  document.addEventListener('fullscreenchange', handleFullScreenChange);
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
  if (playerStore.currentSong?.id) {
    styleEngine.loadClimaxData(String(playerStore.currentSong.id));
  }
  checkStrokes();
  subscribeDrumDetector();
});

onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
  document.removeEventListener('fullscreenchange', handleFullScreenChange);
  if (document.fullscreenElement) document.exitFullscreen();
  unsubscribeDrumDetector();
});

// ==================== 全屏控制 ====================
const isFullScreen = ref(false);

async function toggleFullScreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      isFullScreen.value = true;
    } else {
      await document.exitFullscreen();
      isFullScreen.value = false;
    }
  } catch (e) {
    console.error('全屏切换失败:', e);
  }
}

function handleFullScreenChange() {
  isFullScreen.value = !!document.fullscreenElement;
}

function close() {
  isVisible.value = false;
}
</script>

<style lang="scss" scoped>
.neon-player {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #1a1814;

  /* overlay 模式：低 z-index + pointer-events 穿透，让侧边栏可交互 */
  &.overlay-mode {
    z-index: 1;
    pointer-events: none;
  }
}

/* 老旧墙面背景：SVG feTurbulence 生成的粗糙纹理 */
.concrete-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: #2a2620;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.22 0 0 0 0 0.20 0 0 0 0 0.16 0 0 0 0.7 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
    radial-gradient(circle at 20% 50%, rgba(201, 169, 110, 0.04) 0%, transparent 50%),
    radial-gradient(circle at 80% 50%, rgba(180, 150, 100, 0.03) 0%, transparent 50%),
    radial-gradient(circle at 50% 20%, rgba(160, 130, 90, 0.02) 0%, transparent 50%);
  background-size: 512px 512px, cover, cover, cover;
  background-repeat: repeat, no-repeat, no-repeat, no-repeat;
}

/* 泛黄覆层：模拟老旧纸张/墙面的泛黄效果 */
.aged-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(ellipse at 30% 40%, rgba(201, 169, 110, 0.08) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 60%, rgba(180, 140, 80, 0.06) 0%, transparent 50%),
    linear-gradient(135deg, rgba(80, 60, 30, 0.12) 0%, transparent 40%, rgba(60, 40, 20, 0.08) 100%);
  pointer-events: none;
}

/* 四周暗淡光效：模拟四周微弱光源，向内渐变 */
.ambient-glow {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: radial-gradient(
    ellipse at center,
    transparent 30%,
    var(--neon-dim) 75%,
    var(--neon-color) 100%
  );
  opacity: 0.15;
  mix-blend-mode: multiply;
  transition: opacity 0.08s var(--m-ease-out, ease-out);
  pointer-events: none;
}

.lyrics-layer {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 20px;
}

.neon-lyrics {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.05em;
  line-height: 1.2;
}

.neon-space {
  display: inline-block;
  width: 0.3em;
}

.fallback-lyrics {
  font-family: 'Noto Serif SC', serif;
  font-weight: 600;
  font-size: clamp(28px, 5vw, 48px);
  text-align: center;
  letter-spacing: 0.05em;
}

.neon-fade-enter-active,
.neon-fade-leave-active {
  transition: opacity 0.3s var(--m-ease-out, ease);
}

.neon-fade-enter-from,
.neon-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ambient-glow {
    transition: none;
  }
}
</style>
