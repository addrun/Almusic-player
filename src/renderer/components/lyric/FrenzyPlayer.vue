<template>
  <div
    v-if="isVisible"
    class="frenzy-player"
    :class="{ 'overlay-mode': overlayMode }"
    ref="playerRef"
    :style="{ background: backgroundColor }"
    @click="handleTapToggle"
  >
    <!-- 通用控件（overlay 模式下隐藏） -->
    <player-controls
      v-if="!overlayMode"
      v-show="controlsVisible"
      :isFullScreen="isFullScreen"
      :showStyleSwitch="false"
      theme="dark"
      class="no-toggle"
      @close="closePlayer"
      @toggleFullscreen="toggleFullScreen"
    />

    <!-- 背景层：白色故障效果 -->
    <glitch-background
      baseColor="#ffffff"
      accentColor="#d0d0d0"
      :intensity="glitchIntensity"
      :crtIntensity="crtIntensity"
      :speed="0.8"
      :showScanlines="config.frenzyShowScanlines !== false"
    />

    <!-- 高潮过渡闪光（进入/退出高潮时触发，带色偏） -->
    <div class="climax-flash" :style="climaxFlashStyle"></div>

    <!-- 歌词层 -->
    <div class="frenzy-player__lyrics">
      <frenzy-lyrics :lyrics="lyrics" :currentTime="currentTime" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * FrenzyPlayer - 狂躁模式主组件（初稿设计）
 *
 * 白色背景 + 轻微故障效果 + 黑色可拉伸文字 + 红色正常文字 + 无 GSAP 动效
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { useStyleContext } from '@/playerStyles/useStyleContext';
import { drumDetector } from '@/services/drumDetector';
import { useCommunityDataStore } from '@/store/modules/communityData';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import { setCurrentSongId } from '@/utils/emotionalDetector';
import { isMobile } from '@/utils';

import FrenzyLyrics from './FrenzyLyrics.vue';
import GlitchBackground from './GlitchBackground.vue';
import PlayerControls from './PlayerControls.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  overlayMode: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const isVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

function closePlayer() {
  isVisible.value = false;
}

// 移动端控件显隐状态
const controlsVisible = ref(!isMobile.value);

// 移动端：点击屏幕切换控件显隐
function handleTapToggle(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target?.closest('.no-toggle')) return;
  if (isMobile.value) {
    controlsVisible.value = !controlsVisible.value;
  }
}

// 全屏控制
const isFullScreen = ref(false);

async function toggleFullScreen() {
  try {
    if (!document.fullscreenElement) {
      // 全屏整个页面，而非仅全屏 playerRef，确保底栏和弹出层可见
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

const styleEngine = useStyleEngineStore();
const communityData = useCommunityDataStore();
const playerStore = usePlayerStore();
const { nowTime } = useStyleContext();

const playerRef = ref<HTMLElement | null>(null);
const config = ref<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG });

// 从 localStorage 读取配置
function loadConfig() {
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      config.value = { ...DEFAULT_LYRIC_CONFIG, ...parsed };
    } catch {
      config.value = { ...DEFAULT_LYRIC_CONFIG };
    }
  }
}

loadConfig();

// 监听配置变化
function handleConfigUpdate() {
  loadConfig();
}

// 同步当前歌曲 ID 到情感词检测器，并加载副歌数据
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

onMounted(() => {
  window.addEventListener('music-full-config-updated', handleConfigUpdate);
  document.addEventListener('fullscreenchange', handleFullScreenChange);

  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();

  if (playerStore.currentSong?.id) {
    styleEngine.loadClimaxData(String(playerStore.currentSong.id));
  }
});

onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
  document.removeEventListener('fullscreenchange', handleFullScreenChange);
  if (document.fullscreenElement) document.exitFullscreen();
  communityData.clear();
  if (flashTimer) clearTimeout(flashTimer);
  if (flashTimer2) clearTimeout(flashTimer2);
  if (crtRafId) cancelAnimationFrame(crtRafId);
});

// 背景颜色（级联：白色背景 → 跟随封面背景 → 自定义，总开关关闭时默认白色）
const backgroundColor = computed(() => {
  if (config.value.frenzyShowBackgroundColor === false) return '#ffffff';
  if (config.value.frenzyUseWhiteBackground !== false) return '#ffffff';
  if (config.value.frenzyUseCoverBackground !== false) return styleEngine.primaryColor;
  return config.value.frenzyBackgroundCustomColor;
});

// 歌词数据
const lyrics = computed(() => {
  const song = playerStore.currentSong;
  if (!song?.lyric?.lrcArray) return [];
  return song.lyric.lrcArray;
});

// 当前播放时间
const currentTime = computed(() => nowTime.value);

// 故障强度（根据能量级别、高潮状态和鼓点动态调整）
const beatSpike = ref(0);
let spikeTimer: ReturnType<typeof setTimeout> | null = null;
const SPIKE_DURATION = 120; // 鼓点峰值持续 120ms

// 订阅鼓点检测
onMounted(() => {
  const unsubscribe = drumDetector.onBeat((info) => {
    // 强拍峰值更大，kickEnergy 调制强度
    const spikeAmount = info.isStrong ? 0.45 : 0.25;
    beatSpike.value = spikeAmount * (0.6 + info.kickEnergy * 0.4);

    if (spikeTimer) clearTimeout(spikeTimer);
    spikeTimer = setTimeout(() => {
      beatSpike.value = 0;
    }, SPIKE_DURATION);
  });

  onUnmounted(() => {
    unsubscribe();
    if (spikeTimer) clearTimeout(spikeTimer);
  });
});

const glitchIntensity = computed(() => {
  const baseIntensity = config.value.frenzyGlitchIntensity;
  const energyBoost = styleEngine.energyLevel * 0.15;
  const climaxBoost = styleEngine.isInClimax ? 0.3 : 0;
  const base = Math.min(1.0, baseIntensity + energyBoost + climaxBoost);

  // 高潮时鼓点失真峰值明显，非高潮时微弱
  const spike = styleEngine.isInClimax ? beatSpike.value : beatSpike.value * 0.3;

  return Math.min(1.0, base + spike);
});

// CRT 老电视失真强度：带淡入淡出过渡
const crtIntensityCurrent = ref(0);
let crtTarget = 0;
let crtRafId = 0;
const CRT_FADE_SPEED = 0.04; // 每帧变化量，约 250ms 完成过渡

function crtAnimate() {
  const diff = crtTarget - crtIntensityCurrent.value;
  if (Math.abs(diff) < 0.01) {
    crtIntensityCurrent.value = crtTarget;
    crtRafId = 0;
    return;
  }
  crtIntensityCurrent.value += diff * CRT_FADE_SPEED;
  crtRafId = requestAnimationFrame(crtAnimate);
}

const crtIntensity = computed(() => {
  const beatBoost = styleEngine.isInClimax ? beatSpike.value * 0.4 : 0;
  return Math.min(1.0, crtIntensityCurrent.value + beatBoost);
});

watch(() => styleEngine.isInClimax, (inClimax) => {
  crtTarget = inClimax ? 0.6 : 0;
  if (!crtRafId) crtRafId = requestAnimationFrame(crtAnimate);
});

watch(crtIntensity, (val) => {
});

// ==================== 高潮过渡闪光 ====================

const climaxFlashOpacity = ref(0);
const climaxFlashHue = ref(0); // 色偏角度（红/绿/蓝偏移）
let flashTimer: ReturnType<typeof setTimeout> | null = null;
let flashTimer2: ReturnType<typeof setTimeout> | null = null;

const climaxFlashStyle = computed(() => ({
  opacity: climaxFlashOpacity.value,
  filter: `hue-rotate(${climaxFlashHue.value}deg)`,
  mixBlendMode: 'overlay'
}));

// 监听高潮状态变化，触发闪光 + 色偏
watch(
  () => styleEngine.isInClimax,
  (newVal, oldVal) => {
    if (newVal === oldVal) return;

    if (newVal) {
      // 进入高潮：冷色调闪光（蓝偏移）
      climaxFlashOpacity.value = 0.7;
      climaxFlashHue.value = 200;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        climaxFlashOpacity.value = 0;
        climaxFlashHue.value = 0;
      }, 180);
    } else {
      // 退出高潮：暖色调闪光（红偏移）
      climaxFlashOpacity.value = 0.5;
      climaxFlashHue.value = 30;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        climaxFlashOpacity.value = 0;
        climaxFlashHue.value = 0;
      }, 200);
      // 退出高潮后再来一次短闪光
      if (flashTimer2) clearTimeout(flashTimer2);
      flashTimer2 = setTimeout(() => {
        climaxFlashOpacity.value = 0.3;
        climaxFlashHue.value = -20;
        if (flashTimer) clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
          climaxFlashOpacity.value = 0;
          climaxFlashHue.value = 0;
        }, 120);
      }, 250);
    }
  }
);
</script>

<style scoped>
.frenzy-player {
  position: fixed;
  inset: 0;
  z-index: 9998;
  overflow: hidden;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;

  /* overlay 模式：低 z-index + pointer-events 穿透 */
  &:has(.overlay-mode),
  .overlay-mode & {
    z-index: 1;
    pointer-events: none;
  }
}

/* overlay 模式类 */
.frenzy-player.overlay-mode {
  z-index: 1;
  pointer-events: none;
}

.frenzy-player__lyrics {
  color: #1a1a1a;
  font-size: 24px;
}

.climax-flash {
  position: absolute;
  inset: 0;
  background: white;
  pointer-events: none;
  z-index: 15;
  transition: opacity 0.15s ease-out;
}

.frenzy-player__settings-btn:hover {
  background: rgba(0, 0, 0, 0.12);
}

.frenzy-player__lyrics {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}
</style>
