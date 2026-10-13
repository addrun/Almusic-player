<template>
  <!--
    Overlay 模式专用播放器宿主
    - 不使用 n-drawer / Teleport to="#layout-main"，避免切换布局时 DOM 崩溃
    - 根据 playerStyle 动态切换播放器组件
    - default / classic 样式使用 MusicFullBackground（轻量，无 drawer）
    - stage / magazine / frenzy 直接渲染（它们 teleport to="body" 或 position:fixed）
  -->
  <component
    v-if="currentComponent"
    :is="currentComponent"
    :key="playerStyle"
    :model-value="true"
    :background="background"
    :overlay-mode="true"
  />
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, ref } from 'vue';

import MusicFullBackground from '@/components/lyric/MusicFullBackground.vue';
import { getStyle } from '@/playerStyles';
import { DEFAULT_LYRIC_CONFIG } from '@/types/lyric';

const props = defineProps({
  background: {
    type: String,
    default: '#000'
  }
});

const playerStyle = ref<string>(DEFAULT_LYRIC_CONFIG.playerStyle);

function loadConfig() {
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      playerStyle.value = parsed.playerStyle || DEFAULT_LYRIC_CONFIG.playerStyle;
    } catch {
      playerStyle.value = DEFAULT_LYRIC_CONFIG.playerStyle;
    }
  }
}

loadConfig();

function handleConfigUpdate() {
  loadConfig();
}

onMounted(() => {
  window.addEventListener('music-full-config-updated', handleConfigUpdate);
});

onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
});

const currentComponent = computed(() => {
  // default / classic 样式：使用 MusicFullBackground（无 drawer，无 teleport）
  if (playerStyle.value === 'default' || playerStyle.value === 'classic') {
    return markRaw(MusicFullBackground);
  }
  // 其他样式：直接渲染注册的组件（stage/magazine teleport to body，frenzy position:fixed）
  const style = getStyle(playerStyle.value);
  if (style) {
    return markRaw(style.component);
  }
  return markRaw(MusicFullBackground);
});
</script>
