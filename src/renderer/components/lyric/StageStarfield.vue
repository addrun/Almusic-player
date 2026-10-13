<template>
  <teleport to="body">
    <transition name="stage-fade">
      <div
        v-if="isVisible"
        class="starfield-player"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
      >
        <canvas ref="canvasRef" class="starfield-canvas" />

        <transition name="close-fade">
          <div v-show="controlsVisible" class="control-left">
            <div class="control-btn" @click="close" title="关闭">
              <i class="ri-arrow-down-s-line"></i>
            </div>
          </div>
        </transition>

        <transition name="close-fade">
          <div v-show="controlsVisible" class="control-right">
            <n-popover trigger="click" placement="bottom-end" :z-index="99999" raw to="body">
              <template #trigger>
                <div class="control-btn">
                  <i class="ri-settings-3-line"></i>
                </div>
              </template>
              <lyric-settings />
            </n-popover>
            <div class="control-btn" @click="cyclePlayerStyle" :title="playerStyleLabel">
              <i :class="playerStyleIcon"></i>
            </div>
            <div class="control-btn" @click="toggleFullScreen">
              <i :class="isFullScreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'"></i>
            </div>
          </div>
        </transition>

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
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { Howler } from 'howler';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { artistList, playMusic } from '@/hooks/MusicHook';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';

import LyricSettings from './LyricSettings.vue';

// ==================== 粒子数据结构 ====================

interface StarParticle {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  alpha: number;
  depth: number;
  angle: number;
  angularSpeed: number;
  phaseOffset: number;
  wanderStrength: number;
  pulseSpeed: number;
  driftX: number;
  driftY: number;
  alphaTarget: number;
  alphaSpeed: number;
  kickAngle: number;
  kickForce: number;
}

// ==================== Props & Emits ====================

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  background: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue']);

const playerStore = usePlayerStore();

// ==================== 响应式状态 ====================

const isVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const controlsVisible = ref(true);
let hideTimer: ReturnType<typeof setTimeout> | null = null;

// ==================== 配置实时响应 ====================

const configVersion = ref(0);

function handleConfigUpdate() {
  configVersion.value++;
}

// ==================== 播放器样式切换 ====================

const playerStyles = [
  { key: 'default' as const, icon: 'ri-music-2-line', label: '默认' },
  { key: 'classic' as const, icon: 'ri-disc-line', label: '经典' },
  { key: 'stage' as const, icon: 'ri-live-line', label: '舞台' },
  { key: 'starfield' as const, icon: 'ri-star-line', label: '星空' }
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

// ==================== 音频分析 ====================

let analyser: AnalyserNode | null = null;
let frequencyData: Uint8Array | null = null;

function connectAudio() {
  if (analyser) return;
  try {
    const ctx = Howler.ctx as AudioContext;
    if (!ctx || ctx.state === 'closed') return;

    const source = (audioService as any).source as MediaElementAudioSourceNode;
    if (!source) return;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
  } catch {}
}

function disconnectAudio() {
  if (analyser) {
    try {
      analyser.disconnect();
    } catch {}
    analyser = null;
    frequencyData = null;
  }
}

function getFrequencyBands(): { bass: number; mid: number; treble: number } {
  if (!analyser || !frequencyData) return { bass: 0, mid: 0, treble: 0 };

  analyser.getByteFrequencyData(frequencyData);
  const len = frequencyData.length;
  if (len === 0) return { bass: 0, mid: 0, treble: 0 };

  const bassEnd = Math.floor(len * 0.15);
  const midEnd = Math.floor(len * 0.5);

  let bass = 0,
    mid = 0,
    treble = 0;
  for (let i = 0; i < bassEnd; i++) bass += frequencyData[i];
  for (let i = bassEnd; i < midEnd; i++) mid += frequencyData[i];
  for (let i = midEnd; i < len; i++) treble += frequencyData[i];

  bass = bassEnd > 0 ? bass / bassEnd / 255 : 0;
  mid = midEnd - bassEnd > 0 ? mid / (midEnd - bassEnd) / 255 : 0;
  treble = len - midEnd > 0 ? treble / (len - midEnd) / 255 : 0;

  return { bass, mid, treble };
}

// ==================== Canvas 粒子系统 ====================

const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let particles: StarParticle[] = [];
let rafId: number | null = null;

const PARALLAX_STRENGTH = 40;
const MOUSE_SMOOTHING = 0.08;

const mousePos = ref({ x: 0, y: 0 });
const smoothMouse = ref({ x: 0, y: 0 });

const particleCount = computed(() => {
  configVersion.value;
  try {
    const saved = localStorage.getItem('music-full-config');
    if (saved) {
      const config = JSON.parse(saved);
      return Math.max(100, Math.min(600, config.starfieldParticleCount || 400));
    }
  } catch {}
  return 400;
});

watch(particleCount, (newCount) => {
  initParticles(newCount);
});

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  if (ctx) {
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
}

function createParticle(): StarParticle {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const x = Math.random() * w;
  const y = Math.random() * h;
  return {
    x,
    y,
    homeX: x,
    homeY: y,
    vx: 0,
    vy: 0,
    size: 3,
    baseAlpha: 0.75 + Math.random() * 0.25,
    alpha: 0,
    depth: 0.3 + Math.random() * 0.7,
    angle: Math.random() * Math.PI * 2,
    angularSpeed: 0.002 + Math.random() * 0.008,
    phaseOffset: Math.random() * Math.PI * 2,
    wanderStrength: 0.3 + Math.random() * 0.7,
    pulseSpeed: 0.5 + Math.random() * 1.5,
    driftX: (Math.random() - 0.5) * 0.4,
    driftY: -0.1 - Math.random() * 0.3,
    alphaTarget: 0.75 + Math.random() * 0.25,
    alphaSpeed: 0.003 + Math.random() * 0.007,
    kickAngle: 0,
    kickForce: 0
  };
}

function initParticles(count?: number) {
  const n = count || particleCount.value;
  particles = [];
  for (let i = 0; i < n; i++) {
    particles.push(createParticle());
  }
}

// ==================== 渲染循环 ====================

function renderLoop() {
  const canvas = canvasRef.value;
  if (!canvas || !ctx) return;

  const w = window.innerWidth;
  const h = window.innerHeight;

  smoothMouse.value.x += (mousePos.value.x - smoothMouse.value.x) * MOUSE_SMOOTHING;
  smoothMouse.value.y += (mousePos.value.y - smoothMouse.value.y) * MOUSE_SMOOTHING;

  const { bass, mid, treble } = getFrequencyBands();
  const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;

  ctx.clearRect(0, 0, w, h);

  for (const p of particles) {
    updateParticle(p, w, h, bass, mid, treble, energy);
    drawParticle(p);
  }

  rafId = requestAnimationFrame(renderLoop);
}

function updateParticle(
  p: StarParticle,
  w: number,
  h: number,
  bass: number,
  mid: number,
  treble: number,
  energy: number
) {
  const dx = p.homeX - p.x;
  const dy = p.homeY - p.y;
  p.vx += dx * 0.02;
  p.vy += dy * 0.02;
  p.vx *= 0.92;
  p.vy *= 0.92;

  if (bass > 0.5 && p.kickForce < 0.5) {
    p.kickAngle = Math.random() * Math.PI * 2;
    p.kickForce = bass * 10 * p.depth;
  }
  p.kickForce += mid * 1.5 * p.depth;
  p.kickForce *= 0.88;

  p.vx += Math.cos(p.kickAngle) * p.kickForce;
  p.vy += Math.sin(p.kickAngle) * p.kickForce;

  p.angle += p.angularSpeed;
  const w1 = Math.sin(p.angle + p.phaseOffset) * 0.3 * p.wanderStrength;
  const w2 = Math.cos(p.angle * 2.3 + p.phaseOffset) * 0.2 * p.wanderStrength;
  p.vx += p.driftX + w1 + w2;
  p.vy += p.driftY + w2;

  p.x += p.vx;
  p.y += p.vy;

  if (p.y < -20) {
    p.y = h + 20;
    p.homeY = p.y;
  }
  if (p.y > h + 20) {
    p.y = -20;
    p.homeY = p.y;
  }
  if (p.x < -20) {
    p.x = w + 20;
    p.homeX = p.x;
  }
  if (p.x > w + 20) {
    p.x = -20;
    p.homeX = p.x;
  }

  const targetAlpha = p.baseAlpha * (0.7 + energy * 0.3);
  p.alpha += (targetAlpha - p.alpha) * 0.08;
}

function drawParticle(p: StarParticle) {
  if (!ctx) return;
  const px = p.x + smoothMouse.value.x * p.depth * PARALLAX_STRENGTH;
  const py = p.y + smoothMouse.value.y * p.depth * PARALLAX_STRENGTH;

  const depthScale = 0.6 + p.depth * 0.6;
  const depthAlpha = 0.7 + p.depth * 0.3;
  const r = p.size * depthScale;
  const a = p.alpha * depthAlpha;

  const gradient = ctx.createRadialGradient(px, py, 0, px, py, r);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${a})`);
  gradient.addColorStop(0.3, `rgba(255, 255, 255, ${a * 0.6})`);
  gradient.addColorStop(0.7, `rgba(255, 255, 255, ${a * 0.15})`);
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

// ==================== 鼠标事件 ====================

function handleMouseMove(e: MouseEvent) {
  controlsVisible.value = true;
  resetHideTimer();
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  mousePos.value = {
    x: (e.clientX - cx) / cx,
    y: (e.clientY - cy) / cy
  };
}

function handleMouseLeave() {
  mousePos.value = { x: 0, y: 0 };
  resetHideTimer();
}

function resetHideTimer() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    controlsVisible.value = false;
  }, 3000);
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

const isFullScreen = ref(false);

// ==================== isVisible ====================

watch(
  () => isVisible.value,
  (visible) => {
    if (visible) {
      nextTick(() => {
        if (!ctx && canvasRef.value) {
          ctx = canvasRef.value.getContext('2d');
          updateWindowSize();
          initParticles(particleCount.value);
          renderLoop();
        }
        connectAudio();
      });
    } else {
      disconnectAudio();
      ctx = null;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
  }
);

// ==================== 窗口尺寸 ====================

const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);

function updateWindowSize() {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
  resizeCanvas();
}

// ==================== 生命周期 ====================

onMounted(() => {
  resetHideTimer();
  document.addEventListener('fullscreenchange', handleFullScreenChange);
  window.addEventListener('resize', updateWindowSize);
  window.addEventListener('music-full-config-updated', handleConfigUpdate);

  const canvas = canvasRef.value;
  if (canvas) {
    ctx = canvas.getContext('2d');
    updateWindowSize();
    initParticles(particleCount.value);
    renderLoop();
  }

  if (isVisible.value) {
    connectAudio();
  }
});

onBeforeUnmount(() => {
  disconnectAudio();
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  window.removeEventListener('resize', updateWindowSize);
  window.removeEventListener('fullscreenchange', handleFullScreenChange);
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
  if (document.fullscreenElement) document.exitFullscreen();
});
</script>

<style scoped lang="scss">
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

.starfield-player {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #000000;
  z-index: 9998;
  cursor: default;
}

.starfield-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
}

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
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);

  i {
    font-size: 18px;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
}

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
    color: rgba(255, 255, 255, 0.4);
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
</style>
