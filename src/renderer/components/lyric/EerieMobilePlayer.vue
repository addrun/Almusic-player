<template>
  <teleport to="body">
    <transition name="eerie-fade">
      <div
        v-if="isVisible"
        class="eerie-mobile-player"
        :style="{ '--accent-color': accentColor, '--accent-dark': accentDark, '--bg-color': bgColor }"
        @click="handleTapToggle"
      >
        <canvas ref="bgCanvasRef" class="bg-canvas"></canvas>

        <transition-group name="newspaper-flash" tag="div" class="newspaper-layer">
          <div v-for="np in activeNewspapers" :key="np.id" class="newspaper-item" :style="{ backgroundImage: `url(${np.src})` }"></div>
        </transition-group>

        <!-- 歌词层（前奏阶段不显示歌词，只显示噪点背景） -->
        <div class="lyrics-layer">
          <template v-if="!isIntro && isInClimax && climaxDisplayKeywords.length > 0">
            <div class="climax-keywords">
              <span v-for="(kw, i) in climaxDisplayKeywords" :key="i" class="keyword-char" :style="{ color: accentColor, fontSize: climaxFontSizePx, fontWeight: eerieFontWeightValue }">{{ kw.text }}</span>
            </div>
          </template>
          <template v-else-if="!isIntro && currentChars.length > 0">
            <div class="calligraphy-line">
              <span v-for="(charData, i) in currentChars" :key="i" class="calligraphy-char" :style="{ fontSize: charData.size + 'px', color: accentColor, marginLeft: charData.margin + 'px', marginRight: charData.margin + 'px', fontWeight: eerieFontWeightValue }">{{ charData.char }}</span>
            </div>
          </template>
          <div v-else class="lyrics-empty"></div>
        </div>

        <!-- 顶部控件（tap 弹出） -->
        <transition name="ctrl-fade">
          <div v-show="controlsVisible" class="top-controls no-toggle">
            <div class="ctrl-btn" @click="close"><i class="ri-arrow-down-s-line"></i></div>
            <div style="flex:1"></div>
            <div class="ctrl-btn" @click="cycleStyle"><i class="ri-shuffle-line"></i></div>
          </div>
        </transition>

        <!-- 底部控件（tap 弹出） -->
        <transition name="ctrl-fade">
          <div v-show="controlsVisible" class="bottom-controls no-toggle">
            <div class="progress-row">
              <span class="time-text">{{ formatTime(currentTime) }}</span>
              <div class="progress-bar-bg" @click="handleSeek">
                <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
              </div>
              <span class="time-text">{{ formatTime(duration) }}</span>
            </div>
            <div class="control-buttons">
              <div class="ctrl-btn" @click="handlePrev"><i class="ri-skip-back-fill"></i></div>
              <div class="ctrl-btn play-btn" @click="handlePlayPause"><i :class="isPlaying ? 'ri-pause-fill' : 'ri-play-fill'"></i></div>
              <div class="ctrl-btn" @click="handleNext"><i class="ri-skip-forward-fill"></i></div>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';

import { lrcArray, nowIndex, playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import { secondToMinute } from '@/utils';

import { useTapToggle } from '@/composables/useTapToggle';
import { drawCracks } from '@/lib/crackRenderer';
import { startVHSAnimation } from '@/lib/vhsEffect';
import { getClimaxWordCandidates, setCurrentSongId } from '@/utils/emotionalDetector';

import newspaperManifest from '@/assets/textures/newspaper/manifest.json';

// ==================== 署名类歌词检测（参考 SmartMixService）====================
const ATTRIBUTION_KEYWORDS: readonly string[] = [
  // 多字关键词
  '作词', '作曲', '编曲', '填词', '谱曲',
  '制作人', '监制', '统筹', '企划',
  '吉他', '贝斯', '鼓', '键盘', '钢琴', '小提琴', '大提琴', '萨克斯', '笛子', '二胡', '琵琶', '古筝',
  '和声', '伴唱', '合唱', '童声',
  '混音', '母带', '录音', '后期', '编曲混音',
  '录音室', '录音棚', '混音棚',
  '出品', '出品人', '出品方', '发行', '发行公司', '唱片公司',
  '版权', '著作权', '制作公司', '工作室', '厂牌',
  '感谢', '鸣谢', '致谢', '特别感谢', '献给', '谨以此歌',
  'lyrics', 'composed', 'arranged', 'produced', 'mixed', 'mastered',
  'guitar', 'bass', 'drums', 'keyboard', 'piano', 'violin',
  'vocal', 'vocals', 'backing vocal', 'choir',
  'recording', 'mixing', 'mastering',
  'recording studio', 'mixing studio',
  'presented by', 'released by', 'record label',
  'copyright', 'all rights reserved',
  'production company', 'studio', 'label',
  'thanks to', 'acknowledgments', 'dedicated to', 'special thanks',
  'goodbye', 'goodnight', 'thank you', 'thanks for listening', 'to be continued',
  // 单字简写（LRC 歌词中常见的署名行格式："词：xxx"、"曲：xxx"）
  '词', '曲', '编', '唱', '制', '监', '混', '录', '配', '奏', '伴'
];

function isAttributionLyric(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ATTRIBUTION_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  background: { type: String, default: '' },
  overlayMode: { type: Boolean, default: false }
});
const emit = defineEmits(['update:modelValue']);

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();
const { primaryColor } = useCoverColor();
const { controlsVisible, handleTapToggle } = useTapToggle();

const isVisible = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) });
const isPlaying = computed(() => playerStore.isPlay);
const currentTime = computed(() => playerStore.playingTime || 0);
const duration = computed(() => (playMusic.value?.dt || playMusic.value?.duration || 0) / 1000);
const progressPercent = computed(() => duration.value ? (currentTime.value / duration.value) * 100 : 0);
const isInClimax = computed(() => styleEngine.isInClimax);

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

// 切歌时重新加载高潮数据 + 同步情感词检测器
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
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
  if (playerStore.currentSong?.id) {
    styleEngine.loadClimaxData(String(playerStore.currentSong.id));
  }
});

onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
});

const accentColor = computed(() => primaryColor.value || '#888888');
const accentDark = computed(() => {
  const rgb = primaryColor.value?.match(/\d+/g);
  if (!rgb) return '#333333';
  return `rgb(${rgb.map((v: string) => Math.round(Number(v) * 0.4)).join(', ')})`;
});
const isIntro = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0) return true;
  for (let i = 0; i <= idx && i < lrcArray.value.length; i++) {
    const text = lrcArray.value[i]?.text || '';
    if (!isAttributionLyric(text)) return false;
  }
  return true;
});
const bgColor = computed(() => isIntro.value ? accentDark.value : '#0a0a0a');

// 配置值
const eerieFontFamily = computed(() => (config.value as any).eerieFontFamily || 'KaiTi');
const eerieMaxFontSize = computed(() => (config.value as any).eerieMaxFontSize ?? 44);
const eerieMinFontSize = computed(() => (config.value as any).eerieMinFontSize ?? 28);
const eerieClimaxFontSize = computed(() => (config.value as any).eerieClimaxFontSize ?? 80);
// 歌词整体缩放（50~200，对应 0.5x~2.0x）
const eerieLyricScale = computed(() => ((config.value as any).eerieLyricScale ?? 100) / 100);
// 字体粗细（100~900）
const eerieFontWeightValue = computed(() => (config.value as any).eerieFontWeight ?? 700);

const currentChars = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) return [];
  const text = lrcArray.value[idx]?.text || '';
  if (!text) return [];
  const chars = Array.from(text);
  const n = chars.length;
  if (n === 0) return [];
  const scale = eerieLyricScale.value;
  const maxSize = eerieMaxFontSize.value * scale;
  const minSize = eerieMinFontSize.value * scale;
  return chars.map((char, i) => {
    const ratio = n === 1 ? 1 : 1 - Math.sin(Math.PI * (i / (n - 1)));
    const size = minSize + (maxSize - minSize) * ratio;
    return { char, size, margin: -size * 0.08 };
  });
});

const fontFamily = computed(() => {
  const f = eerieFontFamily.value;
  const fallbacks: Record<string, string> = {
    'KaiTi': "'KaiTi', 'STKaiti', 'Noto Serif SC', serif",
    'STKaiti': "'STKaiti', 'KaiTi', 'Noto Serif SC', serif",
    'FangSong': "'FangSong', 'STFangsong', 'Noto Serif SC', serif",
    'SimSun': "'SimSun', 'STSong', serif",
    'LiSu': "'LiSu', 'STLiti', serif",
    'YouYuan': "'YouYuan', 'STXihei', sans-serif",
  };
  return fallbacks[f] || `${f}, 'KaiTi', serif`;
});

const climaxFontSizePx = computed(() => `${eerieClimaxFontSize.value * eerieLyricScale.value}px`);

// 高潮重点词：优先服务器重点词，降级到本地情感词检测（参考 FrenzyLyrics）
// 高潮阶段强制每句选择不同的词汇，避免重复
const climaxDisplayKeywords = ref<{ text: string }[]>([]);
const usedClimaxKeywords = new Set<string>();

function updateClimaxDisplayKeywords() {
  // 优先服务器重点词
  const serverKeywords = styleEngine.currentLineKeywords;
  if (serverKeywords && serverKeywords.length > 0) {
    climaxDisplayKeywords.value = serverKeywords.map((kw) => ({ text: kw.text }));
    return;
  }

  // 降级到本地情感词检测：获取全部候选词，选择第一个未使用的
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) {
    climaxDisplayKeywords.value = [];
    return;
  }
  const text = lrcArray.value[idx]?.text || '';
  if (!text) {
    climaxDisplayKeywords.value = [];
    return;
  }

  const customDict = playerStore.currentSong?.lyric?.frenzyEmotionalDict;
  const candidates = getClimaxWordCandidates(text, customDict);
  if (candidates.length === 0) {
    climaxDisplayKeywords.value = [];
    return;
  }

  // 选择第一个未使用过的候选词
  let selected = candidates.find((c) => !usedClimaxKeywords.has(c));
  if (!selected) {
    // 所有候选词都已使用过，重置已使用列表并重新选择第一个
    usedClimaxKeywords.clear();
    selected = candidates[0];
  }
  usedClimaxKeywords.add(selected);
  climaxDisplayKeywords.value = [{ text: selected }];
}

// 切歌时清空已使用列表
watch(
  () => playerStore.currentSong?.id,
  () => {
    usedClimaxKeywords.clear();
    climaxDisplayKeywords.value = [];
  }
);

// 高潮状态下歌词行变化时，重新选择关键词
watch(
  [nowIndex, isInClimax],
  () => {
    if (isInClimax.value) {
      updateClimaxDisplayKeywords();
    } else {
      climaxDisplayKeywords.value = [];
    }
  },
  { immediate: true }
);

// 切歌词时同步重点词到 styleEngine
watch(nowIndex, (idx) => {
  styleEngine.updateCurrentLineKeywords(idx);
}, { immediate: true });

const bgCanvasRef = ref<HTMLCanvasElement | null>(null);
let noiseStopFn: (() => void) | null = null;

function updateBackground() {
const canvas = bgCanvasRef.value;
if (!canvas) return;
const dpr = window.devicePixelRatio || 1;
const w = window.innerWidth, h = window.innerHeight;

// 只在尺寸真正变化时才设置 canvas.width（设置会重置画布全部状态）
const targetW = w * dpr, targetH = h * dpr;
if (canvas.width !== targetW || canvas.height !== targetH) {
canvas.width = targetW;
canvas.height = targetH;
canvas.style.width = w + 'px';
canvas.style.height = h + 'px';
}
const ctx = canvas.getContext('2d');
if (!ctx) return;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 用 setTransform 替代 scale，避免累积
ctx.clearRect(0, 0, w, h);
ctx.fillStyle = bgColor.value;
ctx.fillRect(0, 0, w, h);
if (isIntro.value) {
// 传入 getter 函数让 VHS 每帧动态获取最新底色
if (noiseStopFn) noiseStopFn();
noiseStopFn = startVHSAnimation(ctx, w, h, () => bgColor.value, {
intensity: 0.7,
snow: 0.4,
scanlines: 0.15,
interference: 0.18,
colorBleed: 2,
rollingBar: true,
fps: 24
});
} else {
if (noiseStopFn) { noiseStopFn(); noiseStopFn = null; }
if (!isInClimax.value) drawCracks(ctx, w, h, { count: 5 + Math.floor(Math.random() * 3), opacity: 0.12, color: accentColor.value, maxDepth: 4 });
}
}

watch(nowIndex, () => nextTick(() => updateBackground()));
watch(isInClimax, () => nextTick(() => updateBackground()));
watch(isVisible, (v) => {
  if (v) nextTick(() => updateBackground());
  else if (noiseStopFn) { noiseStopFn(); noiseStopFn = null; }
});

interface NewspaperItem { id: number; src: string; }
const activeNewspapers = ref<NewspaperItem[]>([]);
let newspaperIdCounter = 0;
let climaxNewspaperTimer: ReturnType<typeof setInterval> | null = null;
const newspaperTextures = (newspaperManifest as any).textures || [];
let climaxIndex = 0;

function flashNewspaper(src: string) {
  const id = newspaperIdCounter++;
  activeNewspapers.value.push({ id, src });
  setTimeout(() => { activeNewspapers.value = activeNewspapers.value.filter((n) => n.id !== id); }, 500);
}
function startClimaxNewspapers() {
  if (climaxNewspaperTimer || newspaperTextures.length === 0) return;
  const cycle = () => { flashNewspaper(newspaperTextures[climaxIndex % newspaperTextures.length].src); climaxIndex++; };
  cycle();
  climaxNewspaperTimer = setInterval(cycle, 500);
}
function stopClimaxNewspapers() {
  if (climaxNewspaperTimer) { clearInterval(climaxNewspaperTimer); climaxNewspaperTimer = null; }
}
watch(isInClimax, (c) => { c ? startClimaxNewspapers() : stopClimaxNewspapers(); });
watch(nowIndex, () => {
  if (!isInClimax.value && newspaperTextures.length > 0 && Math.random() < 0.1) {
    flashNewspaper(newspaperTextures[Math.floor(Math.random() * newspaperTextures.length)].src);
  }
});

function close() { isVisible.value = false; }
function handlePrev() { playerStore.prevPlay(); }
function handleNext() { playerStore.nextPlay(); }
function handlePlayPause() { playerStore.setPlay(playMusic.value); }
function handleSeek(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  playerStore.setPlayTime(((e.clientX - rect.left) / rect.width) * duration.value);
}
function cycleStyle() { window.dispatchEvent(new CustomEvent('music-full-config-updated')); }
function formatTime(s: number): string { return secondToMinute(s); }

onBeforeUnmount(() => { if (noiseStopFn) noiseStopFn(); stopClimaxNewspapers(); });
</script>

<style lang="scss" scoped>
.eerie-mobile-player { position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; background: var(--bg-color); }
.bg-canvas { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
.newspaper-layer { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
.newspaper-item { position: absolute; inset: 0; background-size: cover; background-position: center; background-repeat: no-repeat; mix-blend-mode: overlay; }
.lyrics-layer { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 20px; }
.calligraphy-line { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; max-width: 100%; }
.calligraphy-char { font-family: v-bind(fontFamily); line-height: 1.1; filter: drop-shadow(0 0 1px rgba(0,0,0,0.5)); transition: color 0.3s var(--m-ease-out, ease); text-shadow: 0 0 2px currentColor; }
.climax-keywords { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 0.1em; width: 100%; }
.keyword-char { font-family: v-bind(fontFamily); line-height: 1; text-shadow: 0 0 20px currentColor, 0 0 4px currentColor; animation: keyword-pulse 0.8s var(--m-ease-out, ease) infinite alternate; }
@keyframes keyword-pulse { to { text-shadow: 0 0 30px currentColor, 0 0 8px currentColor; } }
.lyrics-empty { width: 1px; height: 1px; }

.top-controls { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; padding: calc(var(--safe-area-inset-top, 0px) + 16px) 20px 0; z-index: 10;
  .ctrl-btn { @apply flex items-center justify-center w-10 h-10 rounded-full text-xl; color: #f0ece4; background: rgba(255,255,255,0.08); cursor: pointer; transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out); &:active { transform: scale(0.97); } }
}
.bottom-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 0 24px calc(var(--safe-area-inset-bottom, 0px) + 32px); z-index: 10; }
.progress-row { display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
  .time-text { font-size: 12px; color: #666; flex-shrink: 0; min-width: 36px; }
  .progress-bar-bg { flex: 1; height: 2px; background: #333; border-radius: 1px; position: relative; cursor: pointer;
    .progress-bar-fill { position: absolute; left: 0; top: 0; height: 100%; background: var(--accent-color); border-radius: 1px; transition: width 0.1s linear; }
  }
}
.control-buttons { display: flex; align-items: center; justify-content: center; gap: 16px;
  .ctrl-btn { @apply flex items-center justify-center rounded-full cursor-pointer; background: #444; width: 42px; height: 42px; transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);
    i { font-size: 18px; color: #f0ece4; }
    &:active { transform: scale(0.97); }
    &.play-btn { width: 52px; height: 52px; background: var(--accent-color); i { font-size: 24px; color: #fff; } }
  }
}

.eerie-fade-enter-active, .eerie-fade-leave-active { transition: opacity 0.3s var(--m-ease-out, ease); }
.eerie-fade-enter-from, .eerie-fade-leave-to { opacity: 0; }
.ctrl-fade-enter-active, .ctrl-fade-leave-active { transition: opacity 0.2s var(--m-ease-out, ease); }
.ctrl-fade-enter-from, .ctrl-fade-leave-to { opacity: 0; }
.newspaper-flash-enter-active { transition: opacity 0.15s ease; }
.newspaper-flash-leave-active { transition: opacity 0.15s ease; }
.newspaper-flash-enter-from, .newspaper-flash-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .keyword-char { animation: none; } }
</style>
