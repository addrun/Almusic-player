<template>
  <div v-if="isVisible" class="gritty-player" ref="playerRef">
    <!-- 关闭按钮 -->
    <div class="gritty-player__close" @click="closePlayer">
      <i class="ri-arrow-down-s-line"></i>
    </div>

    <!-- 设置按钮 -->
    <div class="gritty-player__settings">
      <div class="gritty-player__settings-btn" @click="toggleSettings">
        <i class="ri-settings-3-line"></i>
      </div>
    </div>

    <!-- 设置面板 Teleport 到 body 避免 z-index 问题 -->
    <Teleport to="body">
      <div v-if="showSettings" class="gritty-settings-overlay" @click.self="showSettings = false">
        <div class="gritty-settings-panel">
          <lyric-settings />
        </div>
      </div>
    </Teleport>

    <!-- 背景层 -->
    <glitch-background
      :baseColor="darkenedColor"
      :accentColor="primaryColor"
      :intensity="glitchIntensity"
      :speed="1.0"
      :showScanlines="config.grittyShowScanlines !== false"
    />

    <!-- 歌词层 -->
    <div class="gritty-player__lyrics">
      <gritty-lyrics :lyrics="lyrics" :currentTime="currentTime" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * GrittyPlayer - 粗粝模式主组件
 *
 * 组合 GLitch 背景、双层歌词、播放控制三个层次
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { nowTime } from '@/hooks/MusicHook';
import { useCommunityDataStore } from '@/store/modules/communityData';
import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { DEFAULT_LYRIC_CONFIG, type LyricConfig } from '@/types/lyric';
import { setCurrentSongId } from '@/utils/emotionalDetector';

import GlitchBackground from './GlitchBackground.vue';
import GrittyLyrics from './GrittyLyrics.vue';
import LyricSettings from './LyricSettings.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const isVisible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
});

function closePlayer() {
  isVisible.value = false;
}

const showSettings = ref(false);
function toggleSettings() {
  showSettings.value = !showSettings.value;
}

const styleEngine = useStyleEngineStore();
const communityData = useCommunityDataStore();
const playerStore = usePlayerStore();

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

// 同步当前歌曲 ID 到情感词检测器
watch(
  () => playerStore.currentSong?.id,
  (songId) => {
    if (songId) setCurrentSongId(String(songId));
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

// 监听歌曲变化，重新加载副歌数据
watch(
  () => playerStore.currentSong?.id,
  (songId) => {
    if (songId) {
      styleEngine.loadClimaxData(String(songId));
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
  communityData.clear();
});

// 歌词数据
const lyrics = computed(() => {
  const song = playerStore.currentSong;
  if (!song?.lyric?.lrcArray) return [];
  return song.lyric.lrcArray;
});

// 当前播放时间
const currentTime = computed(() => nowTime.value);

// 封面颜色
const primaryColor = computed(() => styleEngine.primaryColor);

// 暗化颜色
const darkenedColor = computed(() => {
  const color = styleEngine.primaryColor;
  return darkenColor(color, 0.4);
});

// 故障强度（根据能量级别动态调整）
const glitchIntensity = computed(() => {
  const baseIntensity = config.value.grittyGlitchIntensity;
  const energyBoost = styleEngine.energyLevel * 0.3;
  return Math.min(1, baseIntensity + energyBoost);
});

// 颜色工具函数
function darkenColor(hex: string, amount: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '#1a1a2e';

  const r = Math.max(0, Math.floor(parseInt(result[1], 16) * (1 - amount)));
  const g = Math.max(0, Math.floor(parseInt(result[2], 16) * (1 - amount)));
  const b = Math.max(0, Math.floor(parseInt(result[3], 16) * (1 - amount)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
</script>

<style scoped>
.gritty-player {
  position: fixed;
  inset: 0;
  z-index: 9998;
  overflow: hidden;
  background: #000;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.gritty-player__close {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 9999;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: background 0.2s ease;
  color: #fff;
  font-size: 24px;
}

.gritty-player__close:hover {
  background: rgba(255, 255, 255, 0.25);
}

.gritty-player__settings {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 9999;
}

.gritty-player__settings-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: background 0.2s ease;
  color: #fff;
  font-size: 24px;
}

.gritty-player__settings-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.gritty-player__lyrics {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}
</style>

<style>
.gritty-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
}
.gritty-settings-panel {
  position: fixed;
  top: 72px;
  right: 24px;
  z-index: 10001;
}
</style>
