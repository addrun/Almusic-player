<template>
  <div class="overlay-layout" id="layout-main">
    <title-bar />

    <!-- Layer 0: 播放界面背景（始终可见，根据播放器样式动态切换） -->
    <overlay-player-host v-if="isPlay" :background="background" />

    <!-- 无音乐时的背景 -->
    <div v-else class="overlay-empty-bg"></div>

    <!-- Layer 1: 浮动侧栏 -->
    <floating-sidebar :menus="menuStore.menus" />

    <!-- Layer 2: 浮动搜索栏 -->
    <floating-search-bar />

    <!-- Layer 3: 浮动面板 -->
    <floating-window-manager />

    <!-- Layer 4: 底部播放栏 -->
    <play-bar
      v-show="isPlay"
      :style="{ bottom: '0' }"
    />

    <!-- 其他组件 -->
    <playlist-drawer v-model="showPlaylistDrawer" :song-id="currentSongId" />
    <sleep-timer-top v-if="!settingsStore.isMobile" />
    <playing-list-drawer />
    <update-modal v-if="isElectron" />
  </div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, provide, ref, watch } from 'vue';

import SleepTimerTop from '@/components/player/SleepTimerTop.vue';
import { useMenuStore } from '@/store/modules/menu';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { isElectron } from '@/utils';
import { playMusic as playMusicRef } from '@/hooks/MusicHook';

import FloatingSidebar from './components/FloatingSidebar.vue';
import FloatingSearchBar from './components/FloatingSearchBar.vue';
import OverlayPlayerHost from './components/OverlayPlayerHost.vue';
import TitleBar from './components/TitleBar.vue';
import FloatingWindowManager from '@/components/common/FloatingWindowManager.vue';

const UpdateModal = defineAsyncComponent(() => import('@/components/common/UpdateModal.vue'));
const PlayBar = defineAsyncComponent(() => import('@/components/player/PlayBar.vue'));
const PlayingListDrawer = defineAsyncComponent(
  () => import('@/components/player/PlayingListDrawer.vue')
);
const PlaylistDrawer = defineAsyncComponent(() => import('@/components/common/PlaylistDrawer.vue'));

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();
const menuStore = useMenuStore();

const isPlay = computed(() => playerStore.playMusic && playerStore.playMusic.id);

// ==================== 背景色（与 PlayBar 相同逻辑） ====================
const background = ref('#000');
watch(() => playerStore.playMusic, () => {
  if (playMusicRef?.value?.backgroundColor) background.value = playMusicRef.value.backgroundColor as string;
}, { immediate: true, deep: true });

onMounted(() => {
  settingsStore.initializeSettings();
  settingsStore.initializeTheme();
  document.documentElement.classList.add('overlay-mode');
});

onUnmounted(() => {
  document.documentElement.classList.remove('overlay-mode');
});

const showPlaylistDrawer = ref(false);
const currentSongId = ref<number | undefined>();

const openPlaylistDrawer = (songId: number, isOpen: boolean = true) => {
  currentSongId.value = songId;
  showPlaylistDrawer.value = isOpen;
  playerStore.setMusicFull(false);
  playerStore.setPlayListDrawerVisible(!isOpen);
};

provide('openPlaylistDrawer', openPlaylistDrawer);
</script>

<style lang="scss" scoped>
.overlay-layout {
  @apply w-screen h-screen overflow-hidden relative;
  background: transparent;
}

.overlay-empty-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background: #1a1a1a;
}
.dark .overlay-empty-bg {
  background: #000000;
}
</style>

<style>
/* Overlay mode global styles — non-scoped to affect body/naive-ui components */
html.overlay-mode {
  background: #1a1a1a;
}
html.overlay-mode.dark {
  background: #000000;
}
html.overlay-mode body {
  background: #1a1a1a !important;
}
html.overlay-mode.dark body {
  background: #000000 !important;
}
</style>
