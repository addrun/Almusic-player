<template>
  <teleport to="body">
    <transition name="neon-fade">
      <div
        v-if="isVisible"
        class="neon-mobile-player"
        :style="{ '--neon-color': neonColor, '--neon-bright': neonBright, '--neon-dim': neonDim }"
        @click="handleTapToggle"
      >
        <div class="concrete-bg"></div>
        <div class="aged-overlay"></div>
        <div class="ambient-glow" :style="{ opacity: beatGlowOpacity }"></div>

        <div class="lyrics-layer">
          <div class="neon-lyrics" :style="{ fontSize: lyricFontSize }">
            <template v-for="(char, i) in currentChars" :key="i">
              <span v-if="char === ' '" class="neon-space">&nbsp;</span>
              <neon-stroke-char v-else :char="char" :color="neonColor" :beatSpike="beatSpike" :style="{ fontSize: '1em', animationDelay: i * 0.1 + 's' }" />
            </template>
          </div>
          <div v-if="!hasAnyStrokes && currentText" class="fallback-lyrics" :style="{ color: neonBright }">{{ currentText }}</div>
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { lrcArray, nowIndex, playMusic } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { drumDetector } from '@/services/drumDetector';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { setCurrentSongId } from '@/utils/emotionalDetector';
import { secondToMinute } from '@/utils';

import { useTapToggle } from '@/composables/useTapToggle';
import { loadDictionary, getStrokes } from '@/lib/hanziStrokes';

import NeonStrokeChar from './NeonStrokeChar.vue';

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

const neonColor = computed(() => primaryColor.value || '#c9a96e');
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

const beatSpike = ref(0);
let spikeTimer: ReturnType<typeof setTimeout> | null = null;
let beatUnsubscribe: (() => void) | null = null;
const SPIKE_DURATION = 120;

function subscribeDrumDetector() {
  if (beatUnsubscribe) return;
  beatUnsubscribe = drumDetector.onBeat((info) => {
    const spikeAmount = info.isStrong ? 0.6 : 0.35;
    beatSpike.value = spikeAmount * (0.5 + info.kickEnergy * 0.5);
    if (spikeTimer) clearTimeout(spikeTimer);
    spikeTimer = setTimeout(() => { beatSpike.value = 0; }, SPIKE_DURATION);
  });
}

const beatGlowOpacity = computed(() => 0.15 + beatSpike.value * 0.25);

const currentText = computed(() => {
  const idx = nowIndex.value;
  if (idx < 0 || idx >= lrcArray.value.length) return '';
  return lrcArray.value[idx]?.text || '';
});
const currentChars = computed(() => Array.from(currentText.value || ''));
const lyricFontSize = computed(() => 'clamp(32px, 10vw, 64px)');

const hasAnyStrokes = ref(false);
async function checkStrokes() {
  await loadDictionary();
  for (const char of currentChars.value) {
    if (/[\u4e00-\u9fff]/.test(char)) {
      const s = getStrokes(char);
      if (s && s.length > 0) { hasAnyStrokes.value = true; return; }
    }
  }
  hasAnyStrokes.value = false;
}
watch(currentText, () => checkStrokes());
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
  checkStrokes();
  styleEngine.syncFromPlayerStore();
  styleEngine.syncCoverColors();
  if (playerStore.currentSong?.id) {
    styleEngine.loadClimaxData(String(playerStore.currentSong.id));
  }
  subscribeDrumDetector();
});

onUnmounted(() => {
  if (beatUnsubscribe) { beatUnsubscribe(); beatUnsubscribe = null; }
  if (spikeTimer) { clearTimeout(spikeTimer); spikeTimer = null; }
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
</script>

<style lang="scss" scoped>
.neon-mobile-player { position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; background: #1a1814; }
.concrete-bg {
  position: absolute; inset: 0; z-index: 0; background-color: #2a2620;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.22 0 0 0 0 0.20 0 0 0 0 0.16 0 0 0 0.7 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
    radial-gradient(circle at 20% 50%, rgba(201,169,110,0.03) 0%, transparent 50%),
    radial-gradient(circle at 80% 50%, rgba(180,150,100,0.02) 0%, transparent 50%);
  background-size: 512px 512px, cover, cover;
  background-repeat: repeat, no-repeat, no-repeat;
  filter: brightness(0.5) contrast(1.1) sepia(0.3);
}
.aged-overlay {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(ellipse at 30% 40%, rgba(201,169,110,0.08) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 60%, rgba(180,140,80,0.06) 0%, transparent 50%),
    linear-gradient(135deg, rgba(80,60,30,0.12) 0%, transparent 40%, rgba(60,40,20,0.08) 100%);
  pointer-events: none;
}
.ambient-glow {
  position: absolute; inset: 0; z-index: 1;
  background: radial-gradient(ellipse at center, transparent 35%, var(--neon-dim) 80%, var(--neon-color) 100%);
  opacity: 0.15; mix-blend-mode: multiply;
  transition: opacity 0.1s var(--m-ease-out, ease-out); pointer-events: none;
}
.lyrics-layer { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; padding: 20px; }
.neon-lyrics { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.05em; line-height: 1.2; }
.neon-space { display: inline-block; width: 0.3em; }
.fallback-lyrics {
  font-family: 'Noto Serif SC', serif; font-weight: 600; font-size: clamp(24px, 6vw, 40px);
  text-shadow: 0 0 3px currentColor, 0 0 8px var(--neon-dim);
  text-align: center; letter-spacing: 0.05em;
}

.top-controls { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; padding: calc(var(--safe-area-inset-top, 0px) + 16px) 20px 0; z-index: 10;
  .ctrl-btn { @apply flex items-center justify-center w-10 h-10 rounded-full text-xl; color: #f0ece4; background: rgba(255,255,255,0.08); cursor: pointer; transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out); &:active { transform: scale(0.97); } }
}
.bottom-controls { position: absolute; bottom: 0; left: 0; right: 0; padding: 0 24px calc(var(--safe-area-inset-bottom, 0px) + 32px); z-index: 10; }
.progress-row { display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
  .time-text { font-size: 12px; color: #666; flex-shrink: 0; min-width: 36px; }
  .progress-bar-bg { flex: 1; height: 2px; background: #333; border-radius: 1px; position: relative; cursor: pointer;
    .progress-bar-fill { position: absolute; left: 0; top: 0; height: 100%; background: var(--neon-color); border-radius: 1px; transition: width 0.1s linear; }
  }
}
.control-buttons { display: flex; align-items: center; justify-content: center; gap: 16px;
  .ctrl-btn { @apply flex items-center justify-center rounded-full cursor-pointer; background: #333; width: 42px; height: 42px; transition: transform var(--m-duration-press, 160ms) var(--m-ease-out, ease-out);
    i { font-size: 18px; color: #f0ece4; }
    &:active { transform: scale(0.97); }
    &.play-btn { width: 52px; height: 52px; background: var(--neon-color); i { font-size: 24px; color: #0a0a0a; } }
  }
}

.neon-fade-enter-active, .neon-fade-leave-active { transition: opacity 0.3s var(--m-ease-out, ease); }
.neon-fade-enter-from, .neon-fade-leave-to { opacity: 0; }
.ctrl-fade-enter-active, .ctrl-fade-leave-active { transition: opacity 0.2s var(--m-ease-out, ease); }
.ctrl-fade-enter-from, .ctrl-fade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .ambient-glow { transition: none; } }
</style>
