<template>
  <div
    ref="containerRef"
    class="home-fm-lyrics"
    @mouseenter="pauseAutoScroll = true"
    @mouseleave="resumeAutoScroll"
  >
    <div
      v-if="lyricLines.length === 0"
      class="flex items-center justify-center h-full text-white/30 text-sm"
    >
      暂无歌词
    </div>
    <div v-else ref="listRef" class="home-fm-lyrics-list">
      <div
        v-for="(line, index) in lyricLines"
        :key="index"
        :id="`home-fm-lrc-${index}`"
        class="home-fm-lyric-line"
        :class="{
          'home-fm-lyric-line--active': index === nowIndex,
          'home-fm-lyric-line--past': index < nowIndex
        }"
      >
        {{ line.text }}
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { nextTick, onUnmounted, ref, watch } from 'vue';

import { lrcArray, nowIndex } from '@/hooks/MusicHook';

const containerRef = ref<HTMLElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const pauseAutoScroll = ref(false);
let resumeTimer: ReturnType<typeof setTimeout> | null = null;

const lyricLines = ref<{ text: string; startTime: number }[]>([]);

// Sync lyrics from MusicHook
watch(
  lrcArray,
  (newLrc) => {
    lyricLines.value = (newLrc || []).map((l: any) => ({
      text: l.text || '',
      startTime: l.startTime || 0
    }));
  },
  { immediate: true, deep: true }
);

// Auto scroll to current line
watch(nowIndex, (idx) => {
  if (pauseAutoScroll.value) return;
  nextTick(() => {
    const el = document.getElementById(`home-fm-lrc-${idx}`);
    if (el && listRef.value) {
      const container = listRef.value;
      const elTop = el.offsetTop;
      const containerHeight = container.clientHeight;
      const scrollTo = elTop - containerHeight / 2 + el.clientHeight / 2;
      container.scrollTo({ top: scrollTo, behavior: 'smooth' });
    }
  });
});

const resumeAutoScroll = () => {
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => {
    pauseAutoScroll.value = false;
  }, 2000);
};

onUnmounted(() => {
  if (resumeTimer) clearTimeout(resumeTimer);
});
</script>

<style scoped>
.home-fm-lyrics {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.home-fm-lyrics-list {
  height: 100%;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
}

.home-fm-lyrics-list::-webkit-scrollbar {
  display: none;
}

.home-fm-lyric-line {
  padding: 6px 0;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.35);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1.5;
  cursor: default;
}

.home-fm-lyric-line--active {
  color: rgba(255, 255, 255, 0.95);
  font-size: 16px;
  font-weight: 700;
  transform: scale(1.02);
  transform-origin: left center;
}

.home-fm-lyric-line--past {
  color: rgba(255, 255, 255, 0.5);
}
</style>
