<template>
  <teleport v-if="!overlayMode" to="body">
    <transition name="stage-fade">
      <div
        v-if="isVisible"
        class="stage-player"
        :style="{ '--accent-color': accentColor, '--accent-color-rgb': accentColorRgb }"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
        @click="handleTapToggle"
      >
        <!-- 背景层：封面模糊 + Aurora 极光 -->
        <div class="background-cover" :style="backgroundCoverStyle"></div>
        <aurora
          :colorStops="auroraColorStops"
          :amplitude="auroraAmplitude"
          :blend="0.5"
          :speed="auroraSpeed"
        />

        <!-- 鼓点闪白效果（高潮时跟随鼓点闪烁） -->
        <div class="beat-flash" :style="{ opacity: beatSpike }"></div>

        <!-- 通用控件（左上关闭 + 右上设置/模式切换/全屏） -->
        <player-controls
          :isFullScreen="isFullScreen"
          :styleIcon="playerStyleIcon"
          :styleLabel="playerStyleLabel"
          :autoHide="true"
          @close="close"
          @cycleStyle="cyclePlayerStyle"
          @toggleFullscreen="toggleFullScreen"
        />

        <!-- 顶部：歌曲信息 -->
        <transition name="info-fade">
          <div v-show="controlsVisible" class="song-info-top">
            <div class="song-name">{{ playMusic?.name }}</div>
            <div class="song-artist">
              <span v-for="(item, index) in artistList" :key="index" class="artist-name">
                {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
              </span>
            </div>
          </div>
        </transition>

        <!-- 中央：歌词显示区 -->
        <div class="lyric-container">
          <!-- 背景词层 -->
          <transition name="bg-fade">
            <div v-if="backgroundLine?.text" class="background-lyric" :style="lyricStyle">
              {{ backgroundLine.text }}
            </div>
          </transition>
          <!-- 主歌词层 -->
          <div ref="lyricRef" class="single-lyric" :style="lyricStyle">
            {{ displayText }}
          </div>
          <!-- 翻译歌词 -->
          <transition name="tr-fade">
            <div v-if="currentLine?.trText && controlsVisible" class="lyric-translation">
              {{ currentLine.trText }}
            </div>
          </transition>
        </div>
      </div>
    </transition>
  </teleport>

  <!-- overlay 模式：直接渲染，不 teleport，低 z-index，pointer-events 穿透 -->
  <div
    v-if="overlayMode && isVisible"
    class="stage-player overlay-mode"
    :style="{ '--accent-color': accentColor, '--accent-color-rgb': accentColorRgb }"
  >
    <div class="background-cover" :style="backgroundCoverStyle"></div>
    <aurora
      :colorStops="auroraColorStops"
      :amplitude="auroraAmplitude"
      :blend="0.5"
      :speed="auroraSpeed"
    />
    <div class="beat-flash" :style="{ opacity: beatSpike }"></div>

    <!-- 顶部：歌曲信息 -->
    <div class="song-info-top">
      <div class="song-name">{{ playMusic?.name }}</div>
      <div class="song-artist">
        <span v-for="(item, index) in artistList" :key="index" class="artist-name">
          {{ item.name }}{{ index < artistList.length - 1 ? ' / ' : '' }}
        </span>
      </div>
    </div>

    <!-- 中央：歌词显示区 -->
    <div class="lyric-container">
      <transition name="bg-fade">
        <div v-if="backgroundLine?.text" class="background-lyric" :style="lyricStyle">
          {{ backgroundLine.text }}
        </div>
      </transition>
      <div ref="lyricRef" class="single-lyric" :style="lyricStyle">
        {{ displayText }}
      </div>
      <transition name="tr-fade">
        <div v-if="currentLine?.trText" class="lyric-translation">
          {{ currentLine.trText }}
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * StagePlayer 舞台播放器组件
 *
 * 全屏沉浸式歌词播放界面，包含：
 * - 封面取色烟雾背景
 * - 封面取色强调色（歌词/按钮）
 * - 普通/节奏两种歌词动画模式
 * - 3秒无鼠标操作自动隐藏控件
 */
import gsap from 'gsap';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import Aurora from '@/components/Aurora.vue';
import {
  allTime,
  artistList,
  lrcArray,
  nowIndex,
  nowTime,
  playMusic,
  setAudioTime
} from '@/hooks/MusicHook';
import { useStyleContext } from '@/playerStyles/useStyleContext';
import { drumDetector } from '@/services/drumDetector';
import { useClimaxStore } from '@/store/modules/climax';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { usePlayerStore } from '@/store/modules/player';
import { DEFAULT_LYRIC_CONFIG } from '@/types/lyric';
import type { ILyricText, IWordData } from '@/types/music';
import { getImgUrl, isMobile } from '@/utils';
import { AnimationSelector } from '@/utils/animationSelector';
// 舞台动画预设库
import { normalAnimations, powerAnimations, softAnimations } from '@/utils/stageAnimations';

import LyricSettings from './LyricSettings.vue';
import PlayerControls from './PlayerControls.vue';

// 从 localStorage 读取动画强度设置
const animationIntensity = computed<'soft' | 'normal' | 'power'>(() => {
  try {
    const saved = localStorage.getItem('music-full-config');
    if (saved) {
      const config = JSON.parse(saved);
      return config.animationIntensity || 'normal';
    }
  } catch {}
  return 'normal';
});

// 从 localStorage 读取高潮闪光设置
const stageBeatFlashEnabled = computed(() => {
  try {
    const saved = localStorage.getItem('music-full-config');
    if (saved) {
      const config = JSON.parse(saved);
      return config.stageBeatFlash !== false;
    }
  } catch {}
  return true;
});

const stageFlashIntensity = computed(() => {
  try {
    const saved = localStorage.getItem('music-full-config');
    if (saved) {
      const config = JSON.parse(saved);
      return config.stageFlashIntensity ?? 0.5;
    }
  } catch {}
  return 0.5;
});

// 根据强度获取动画集合
const currentAnimations = computed(() => {
  switch (animationIntensity.value) {
    case 'soft':
      return softAnimations;
    case 'power':
      return powerAnimations;
    default:
      return normalAnimations;
  }
});

let animationSelector = new AnimationSelector(currentAnimations.value.length);

// 动画强度变更时重建选择器，确保总数匹配
watch(animationIntensity, () => {
  animationSelector = new AnimationSelector(currentAnimations.value.length);
});

// ==================== Props & Emits ====================

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  background: { type: String, default: '' },
  overlayMode: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const playerStore = usePlayerStore();

// ==================== 响应式状态 ====================

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const currentLine = computed<ILyricText | undefined>(() => lrcArray.value[nowIndex.value]);
const currentLineKey = computed(() => `${nowIndex.value}-${currentLine.value?.text}`);

// 背景词：查找当前歌词的下一行 isBG 为 true 的歌词
const backgroundLine = computed(() => {
  if (nowIndex.value < 0) return undefined;
  const nextIdx = nowIndex.value + 1;
  if (nextIdx < lrcArray.value.length) {
    const nextLine = lrcArray.value[nextIdx];
    if (nextLine?.isBG) return nextLine;
  }
  return undefined;
});

const controlsVisible = ref(!isMobile.value);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

// ==================== 播放器样式切换 ====================

const playerStyles = [
  { key: 'default' as const, icon: 'ri-music-2-line', label: '默认' },
  { key: 'classic' as const, icon: 'ri-disc-line', label: '经典' },
  { key: 'stage' as const, icon: 'ri-live-line', label: '舞台' },
  { key: 'magazine' as const, icon: 'ri-layout-masonry-line', label: '杂志' }
];

const currentStyleIndex = computed(() => {
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return playerStyles.findIndex((s) => s.key === (parsed.playerStyle || 'default'));
    } catch {
      return 0;
    }
  }
  return 0;
});

const playerStyleIcon = computed(
  () => playerStyles[currentStyleIndex.value]?.icon || playerStyles[0].icon
);
const playerStyleLabel = computed(
  () => playerStyles[currentStyleIndex.value]?.label || playerStyles[0].label
);

function cyclePlayerStyle() {
  const next = (currentStyleIndex.value + 1) % playerStyles.length;
  const newStyle = playerStyles[next].key;
  const saved = localStorage.getItem('music-full-config');
  const config = saved ? JSON.parse(saved) : {};
  config.playerStyle = newStyle;
  localStorage.setItem('music-full-config', JSON.stringify(config));
  window.dispatchEvent(new Event('music-full-config-updated'));
}

// ==================== 封面取色 ====================

const accentColor = ref('rgb(220, 200, 170)');
const accentColorRgb = ref('220, 200, 170');

// Aurora 极光颜色：从封面取色生成三色渐变
const auroraColorStops = computed(() => {
  const rgb = accentColorRgb.value;
  const [r, g, b] = rgb.split(',').map(Number);
  // 深色底色
  const dark = `rgb(${Math.round(r * 0.2)}, ${Math.round(g * 0.2)}, ${Math.round(b * 0.3)})`;
  // 中间色：强调色本身
  const mid = `rgb(${r}, ${g}, ${b})`;
  // 亮色：高亮版本
  const bright = `rgb(${Math.min(255, Math.round(r * 1.4))}, ${Math.min(255, Math.round(g * 1.3))}, ${Math.min(255, Math.round(b * 1.2))})`;
  return [dark, mid, bright];
});

// Aurora 振幅：高潮时增强
const auroraAmplitude = computed(() => (isInClimax.value ? 1.5 : 1.0));

// Aurora 速度：高潮时加速
const auroraSpeed = computed(() => (isInClimax.value ? 1.6 : 0.8));

// ==================== 高潮段落 ====================

const climaxStore = useClimaxStore();

// 当前是否在高潮段落内
const isInClimax = computed(() => {
  const t = nowTime.value;
  return climaxStore.segments.some((seg) => t >= seg.start && t <= seg.end);
});

// 高潮时增强歌词动画
const climaxAnimationBoost = computed(() => (isInClimax.value ? 1.5 : 1));

// ==================== 鼓点闪白 ====================

const styleEngine = useStyleEngineStore();

const beatSpike = ref(0);
let spikeTimer: ReturnType<typeof setTimeout> | null = null;
const SPIKE_DURATION = 150;
let unsubscribeBeat: (() => void) | null = null;

// 只在高潮期间启动鼓点检测（仿照 climaxDriver 模式）
function startBeatListening() {
  if (unsubscribeBeat) return;
  drumDetector.start();
  unsubscribeBeat = drumDetector.onBeat((info) => {
    const intensity = stageFlashIntensity.value;
    beatSpike.value = (info.isStrong ? 0.5 : 0.35) * intensity;
    if (spikeTimer) clearTimeout(spikeTimer);
    spikeTimer = setTimeout(() => {
      beatSpike.value = 0;
    }, SPIKE_DURATION);
  });
}

function stopBeatListening() {
  if (unsubscribeBeat) {
    unsubscribeBeat();
    unsubscribeBeat = null;
  }
  drumDetector.stop();
  beatSpike.value = 0;
  if (spikeTimer) {
    clearTimeout(spikeTimer);
    spikeTimer = null;
  }
}

// 监听高潮状态变化（仅在开启闪光时生效）
watch(isInClimax, (inClimax) => {
  if (!stageBeatFlashEnabled.value) return;
  if (inClimax) {
    startBeatListening();
  } else {
    stopBeatListening();
  }
});

// 监听闪光开关变化
watch(stageBeatFlashEnabled, (enabled) => {
  if (!enabled) {
    stopBeatListening();
  }
});

onBeforeUnmount(() => {
  stopBeatListening();
});

watch(
  () => playMusic.value?.picUrl,
  async (picUrl) => {
    if (!picUrl) return;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = getImgUrl(picUrl, '50y50');
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, 10, 10);
      const data = ctx.getImageData(0, 0, 10, 10).data;

      let r = 0,
        g = 0,
        b = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      const pixelCount = data.length / 4;
      r = Math.round(r / pixelCount);
      g = Math.round(g / pixelCount);
      b = Math.round(b / pixelCount);

      // 强调色：偏暖金色调，高亮度
      // 提高红绿比例，降低蓝色，生成温暖的金色
      const warmR = Math.min(255, Math.round(r * 1.5 + 30));
      const warmG = Math.min(255, Math.round(g * 1.3 + 20));
      const warmB = Math.min(255, Math.round(b * 0.8 + 40));
      accentColor.value = `rgb(${warmR}, ${warmG}, ${warmB})`;
      accentColorRgb.value = `${warmR}, ${warmG}, ${warmB}`;
    } catch {}
  },
  { immediate: true }
);

const backgroundCoverStyle = computed(() => {
  const picUrl = playMusic.value?.picUrl;
  if (!picUrl) return {};
  return {
    backgroundImage: `url(${getImgUrl(picUrl, '1000y1000')})`,
    filter: 'blur(50px) brightness(1) saturate(1.4)',
    opacity: 0.35,
    transform: 'scale(1.2)'
  };
});

// ==================== 歌词样式（响应式字号） ====================

const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);

function updateWindowSize() {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
}

onMounted(() => {
  window.addEventListener('resize', updateWindowSize);
  updateWindowSize();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateWindowSize);
});

// 字号相对于窗口高度：约 5.5% 的高度，限制在 28px ~ 72px 之间
const lyricFontSize = computed(() => {
  const vh = windowHeight.value;
  const size = Math.round(vh * 0.055);
  return Math.max(28, Math.min(72, size));
});

const lyricStyle = computed(() => ({
  fontFamily: 'var(--current-font-family)',
  fontSize: `${lyricFontSize.value}px`,
  fontWeight: 'var(--lyric-font-weight, 700)',
  letterSpacing: 'var(--lyric-letter-spacing, 0px)',
  lineHeight: 'var(--lyric-letter-height, 1.4)'
}));

// ==================== 计算属性 ====================

const isFullScreen = ref(false);
const lyricRef = ref<HTMLElement | null>(null);
const displayText = ref('');
let currentTimeline: gsap.core.Timeline | null = null;
let lastProcessedIndex = -1;
let pendingRafId: number | null = null;
let animationCycleId = 0;

// ==================== 歌词动画 ====================

// ==================== 歌词动画触发 ====================

// 切歌时清空歌词显示并加载高潮数据
let prevSongId: string | undefined;
watch(
  () => playMusic.value?.id,
  (newId) => {
    if (newId !== prevSongId) {
      prevSongId = newId;
      displayText.value = '';
      lastProcessedIndex = -1;
      // 加载高潮段落
      if (newId) {
        climaxStore.loadSegments(String(newId));
      } else {
        climaxStore.clear();
      }
      const el = lyricRef.value;
      if (el) {
        gsap.set(el, {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          filter: 'none',
          autoAlpha: 0,
          clearProps: 'transform'
        });
      }
    }
  }
);

// 当舞台播放器变为可见时，同步显示当前歌词
watch(
  () => isVisible.value,
  (visible) => {
    if (visible) {
      nextTick(() => {
        const line = currentLine.value;
        if (line && displayText.value !== line.text) {
          displayText.value = line.text;
          lastProcessedIndex = nowIndex.value;
        }
      });
    }
  }
);

// 安全网：确保 displayText 始终与 currentLine 同步
watch(
  () => currentLine.value,
  (line) => {
    if (!line) return;
    if (displayText.value !== line.text && displayText.value.length === 0) {
      displayText.value = line.text;
      lastProcessedIndex = nowIndex.value;
    }
  }
);

// 动画方向映射：根据动画索引和强度决定初始位置/缩放/模糊
function getAnimationDirection(animIndex: number): {
  x?: number;
  y?: number;
  scale?: number;
  blur?: number;
} {
  const intensity = animationIntensity.value;
  const mult = intensity === 'power' ? 1.8 : intensity === 'soft' ? 0.5 : 1;

  // 索引 0-4 在所有强度下含义相同
  const dirs: Record<number, { x?: number; y?: number; scale?: number; blur?: number }> = {
    0: { x: Math.round(80 * mult) },
    1: { x: Math.round(-80 * mult) },
    2: { y: Math.round(-50 * mult) },
    3: { y: Math.round(50 * mult) },
    4: {}
  };

  if (intensity === 'normal') {
    // 普通模式: 5=scaleIn, 6=blurIn
    dirs[5] = { scale: 0.5 };
    dirs[6] = { blur: 12 };
  } else {
    // 力量/柔和模式: 5=wordByWord(无需方向), 6=scaleIn, 7=blurIn
    dirs[5] = {};
    dirs[6] = { scale: intensity === 'power' ? 0.3 : 0.8 };
    dirs[7] = { blur: intensity === 'power' ? 20 : 5 };
  }

  return dirs[animIndex] || {};
}

watch(
  () => nowIndex.value,
  (newIndex, oldIndex) => {
    if (newIndex === oldIndex) return;

    const el = lyricRef.value;
    if (!el) return;

    // 取消之前的 requestAnimationFrame
    if (pendingRafId !== null) {
      cancelAnimationFrame(pendingRafId);
      pendingRafId = null;
    }

    // 中断之前的动画
    if (currentTimeline) {
      currentTimeline.kill();
      currentTimeline = null;
    }

    // 递增动画周期ID，防止旧周期的回调在新周期中执行
    const cycleId = ++animationCycleId;

    const animIndex = animationSelector.select(newIndex);
    const direction = getAnimationDirection(animIndex);
    const newText = currentLine.value?.text || '';

    // 立即更新 displayText，防止快速切歌词时重复显示旧文字
    if (displayText.value !== newText) {
      displayText.value = newText;
    }
    lastProcessedIndex = newIndex;

    // 划入动画（索引0-3）使用直接隐藏，其他使用渐隐
    const isSlideIn = animIndex >= 0 && animIndex <= 3;
    const hadPreviousText = oldIndex >= 0 && oldIndex < lrcArray.value.length;

    if (hadPreviousText && !isSlideIn) {
      // 非滑入动画：先退场淡出，再入场（用 onComplete + cycleId 取代 .call()）
      const exitTl = gsap.timeline();
      exitTl.to(el, { autoAlpha: 0, duration: 0.25, ease: 'power2.in' });
      exitTl.eventCallback('onComplete', () => {
        if (animationCycleId !== cycleId) return;
        gsap.set(el, {
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          filter: 'none',
          autoAlpha: 0,
          clearProps: 'transform'
        });
        nextTick(() => {
          if (animationCycleId !== cycleId) return;
          applyEnterAnimation(el, newText, animIndex, direction);
        });
      });
      currentTimeline = exitTl;
    } else {
      // 滑入动画或无前文：直接重置后入场
      gsap.set(el, {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        filter: 'none',
        autoAlpha: 0,
        clearProps: 'transform'
      });
      nextTick(() => {
        if (animationCycleId !== cycleId) return;
        pendingRafId = requestAnimationFrame(() => {
          if (animationCycleId !== cycleId) return;
          applyEnterAnimation(el, newText, animIndex, direction);
        });
      });
    }
  }
);

function applyEnterAnimation(
  el: HTMLElement,
  text: string,
  animIndex: number,
  direction: { x?: number; y?: number; scale?: number; blur?: number }
) {
  // 强制重置所有属性，并设为不可见（防止 Vue 渲染文字后闪帧）
  gsap.set(el, {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    filter: 'none',
    autoAlpha: 0,
    clearProps: 'transform'
  });

  // 设置位置/缩放/模糊
  const initProps: gsap.TweenVars = { duration: 0 };
  if (direction.x !== undefined) initProps.x = direction.x;
  if (direction.y !== undefined) initProps.y = direction.y;
  if (direction.scale !== undefined) initProps.scale = direction.scale;
  if (direction.blur !== undefined) initProps.filter = `blur(${direction.blur}px)`;
  gsap.set(el, initProps);

  // 更新文字
  displayText.value = text;

  // 下一帧执行入场动画
  requestAnimationFrame(() => {
    const animFn = currentAnimations.value[animIndex];
    if (animFn && typeof animFn === 'function') {
      try {
        const tl = animFn(el, { duration: 0.7 });
        currentTimeline = tl;
      } catch {}
    }
  });
}

// ==================== 控件自动隐藏 ====================

function handleMouseMove() {
  controlsVisible.value = true;
  resetHideTimer();
}

function handleMouseLeave() {
  resetHideTimer();
}

function resetHideTimer() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    controlsVisible.value = false;
  }, 3000);
}

// 移动端：点击屏幕切换控件显隐
function handleTapToggle(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target?.closest('.no-toggle')) return;
  if (isMobile.value) {
    controlsVisible.value = !controlsVisible.value;
  }
}

// ==================== 播放控制 ====================

function close() {
  playerStore.setMusicFull(false);
  isVisible.value = false;
}

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

onMounted(() => {
  resetHideTimer();
  document.addEventListener('fullscreenchange', handleFullScreenChange);
});

onBeforeUnmount(() => {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (pendingRafId !== null) {
    cancelAnimationFrame(pendingRafId);
    pendingRafId = null;
  }
  document.removeEventListener('fullscreenchange', handleFullScreenChange);
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
});
</script>

<style scoped lang="scss">
// ==================== 过渡 ====================

.stage-fade-enter-active {
  transition: opacity 0.6s cubic-bezier(0.32, 0.72, 0, 1);
}
.stage-fade-leave-active {
  transition: opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}
.stage-fade-enter-from,
.stage-fade-leave-to {
  opacity: 0;
}

.close-fade-enter-active,
.info-fade-enter-active {
  transition:
    opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1),
    transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.close-fade-leave-active,
.info-fade-leave-active {
  transition:
    opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.close-fade-enter-from,
.info-fade-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.close-fade-leave-to,
.info-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.tr-fade-enter-active,
.tr-fade-leave-active {
  transition: opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}
.tr-fade-enter-from,
.tr-fade-leave-to {
  opacity: 0;
}

.bg-fade-enter-active {
  transition: opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.bg-fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.bg-fade-enter-from,
.bg-fade-leave-to {
  opacity: 0;
}

// ==================== 容器 ====================

.stage-player {
  --accent-color: rgb(180, 150, 100);
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #1a1510;
  z-index: 9998;
  cursor: default;

  // overlay 模式：低 z-index + pointer-events 穿透，让侧边栏可交互
  &.overlay-mode {
    z-index: 1;
    pointer-events: none;

    .song-info-top,
    .lyric-container {
      pointer-events: none;
    }
  }
}

// ==================== 背景 ====================

.background-cover {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  pointer-events: none;
  will-change: transform;
  animation: coverPulse 8s ease-in-out infinite alternate;
}

@keyframes coverPulse {
  0% {
    transform: scale(1.15);
    filter: blur(50px) brightness(0.9) saturate(1.4);
  }
  100% {
    transform: scale(1.25);
    filter: blur(50px) brightness(1.1) saturate(1.6);
  }
}

// ==================== 鼓点闪白 ====================

.beat-flash {
  position: absolute;
  inset: 0;
  background: white;
  pointer-events: none;
  z-index: 5;
  transition: opacity 0.15s ease-out;
}

.background-smoke {
  position: absolute;
  inset: -20%;
  pointer-events: none;
  will-change: transform;
  transition: background 2s ease;
  mix-blend-mode: screen;
}

// ==================== 控制按钮 ====================

.control-left {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 9999;
}

.control-right {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  gap: 8px;
}

.control-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);

  i {
    font-size: 18px;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.35);
    color: rgb(var(--accent-color-rgb, 136, 136, 136));
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
}

// ==================== 顶部歌曲信息 ====================

.song-info-top {
  position: absolute;
  top: 28px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 9999;

  .song-name {
    font-size: 15px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
  }

  .song-artist {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 2px;

    .artist-name {
      cursor: pointer;
      transition: color 0.2s;
      &:hover {
        color: rgba(255, 255, 255, 0.8);
      }
    }
  }
}

// ==================== 歌词 ====================

.lyric-container {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  pointer-events: none;
}

// 背景词样式：40% 透明度，70% 字号，位于主歌词后面
.background-lyric {
  position: absolute;
  font-size: 0.7em;
  opacity: 0.4;
  text-align: center;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 0;
  white-space: nowrap;
}

.single-lyric {
  font-size: clamp(32px, 5vw, 56px);
  font-weight: 700;
  text-align: center;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lyric-word {
  display: inline-block;
}

.lyric-translation {
  margin-top: 16px;
  font-size: clamp(16px, 2.5vw, 24px);
  color: rgba(255, 255, 255, 0.45);
  font-weight: 400;
  text-align: center;
}
</style>
