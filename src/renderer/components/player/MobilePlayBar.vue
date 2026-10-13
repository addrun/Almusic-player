<template>
  <div
    ref="playBarRef"
    class="mobile-play-bar"
    :class="[
      setAnimationClass('animate__fadeInUp'),
      playerStore.musicFull ? 'play-bar-expanded' : 'play-bar-mini',
      shouldShowMobileMenu ? 'is-menu-show' : 'is-menu-hide'
    ]"
    :style="{
      color: playerStore.musicFull
        ? textColors.theme === 'dark'
          ? '#ffffff'
          : '#ffffff'
        : settingsStore.theme === 'dark'
          ? '#ffffff'
          : '#000000'
    }"
  >
    <!-- 迷你模式 - musicFull 为 false 时显示 -->
    <div v-if="!playerStore.musicFull" class="mobile-mini-controls">
      <!-- 歌曲信息 -->
      <div class="mini-song-info" @click="setMusicFull">
        <n-image
          :src="getImgUrl(playMusic?.picUrl, '100y100')"
          class="mini-song-cover"
          lazy
          preview-disabled
        />
        <div class="mini-song-text">
          <n-ellipsis line-clamp="1">
            <span class="mini-song-title">{{ playMusic.name }}</span>
            <span class="mx-2 text-gray-500 dark:text-gray-400">-</span>
            <span
              class="mini-song-artist"
              v-for="(artists, artistsindex) in artistList"
              :key="artistsindex"
            >
              {{ artists.name }}{{ artistsindex < artistList.length - 1 ? ' / ' : '' }}
            </span>
          </n-ellipsis>
        </div>
      </div>

      <div class="mini-playback-controls">
        <div class="mini-control-btn play" @click="playMusicEvent">
          <i class="iconfont icon" :class="play ? 'icon-stop' : 'icon-play'"></i>
        </div>
        <i class="iconfont icon-list mini-list-icon" @click="openPlayListDrawer"></i>
      </div>
    </div>

    <!-- 全屏播放器 -->
    <music-full-wrapper
      ref="MusicFullRef"
      v-model="playerStore.musicFull"
      :background="background"
    />
  </div>
</template>

<script lang="ts" setup>
import { useSwipe } from '@vueuse/core';
import type { Ref } from 'vue';
import { computed, inject, onMounted, ref, watch } from 'vue';

import MusicFullWrapper from '@/components/lyric/MusicFullWrapper.vue';
import { artistList, playMusic, textColors } from '@/hooks/MusicHook';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { getImgUrl, setAnimationClass } from '@/utils';

const shouldShowMobileMenu = inject('shouldShowMobileMenu') as Ref<boolean>;

const playerStore = usePlayerStore();
const settingsStore = useSettingsStore();

// 是否播放
const play = computed(() => playerStore.isPlay);
// 背景颜色
const background = ref('#000');

// 播放控制
function handleNext() {
  playerStore.nextPlay();
}

function handlePrev() {
  playerStore.prevPlay();
}

// 全屏播放器引用
const MusicFullRef = ref<any>(null);

// 设置 musicFull
const setMusicFull = () => {
  playerStore.setMusicFull(!playerStore.musicFull);
  if (playerStore.musicFull) {
    settingsStore.showArtistDrawer = false;
  }
};

watch(
  () => playerStore.musicFull,
  (_newVal) => {
    // 状态栏样式更新已在 Web 环境中禁用
  }
);

// 打开播放列表抽屉
const openPlayListDrawer = () => {
  playerStore.setPlayListDrawerVisible(true);
};

// 播放暂停按钮事件
const playMusicEvent = async () => {
  try {
    playerStore.setPlay(playMusic.value);
  } catch (error) {
    console.error('播放出错:', error);
    playerStore.nextPlay();
  }
};

// 滑动切歌
const playBarRef = ref<HTMLElement | null>(null);
onMounted(() => {
  if (playBarRef.value) {
    const { direction } = useSwipe(playBarRef, {
      onSwipeEnd: () => {
        if (direction.value === 'left') handleNext();
        if (direction.value === 'right') handlePrev();
      },
      threshold: 30
    });
  }
});

watch(
  () => playerStore.playMusic,
  async () => {
    background.value = playMusic.value.backgroundColor as string;
  },
  { immediate: true, deep: true }
);
</script>

<style lang="scss" scoped>
.mobile-play-bar {
  @apply fixed bottom-[76px] left-0 w-full flex flex-col;
  z-index: 10000;
  animation-duration: 0.3s !important;
  transition: all 0.3s ease;

  &.is-menu-show {
    bottom: calc(var(--safe-area-inset-bottom, 0) + 66px);
  }
  &.is-menu-hide {
    bottom: calc(var(--safe-area-inset-bottom, 0) + 10px);
  }

  &.play-bar-expanded {
    @apply bg-transparent;
    height: auto;
    max-height: 230px;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.5) 20%,
      rgba(0, 0, 0, 0.8) 80%,
      rgba(0, 0, 0, 0.9) 100%
    );
  }

  &.play-bar-mini {
    @apply h-14 py-0;
  }

  // 进度条
  .music-progress-bar {
    @apply flex items-center justify-between px-4 py-2 relative z-10;

    .current-time,
    .total-time {
      @apply text-xs text-white opacity-80;
    }

    .progress-wrapper {
      @apply flex-1 mx-3 flex flex-col items-center;

      .progress-slider {
        @apply w-full;

        :deep(.n-slider) {
          --n-rail-height: 3px;
          --n-rail-color: rgba(255, 255, 255, 0.15);
          --n-rail-color-dark: rgba(255, 255, 255, 0.15);
          --n-fill-color: var(--accent-color);
          --n-handle-size: 0px;
          --n-handle-color: var(--accent-color);

          &:hover {
            --n-handle-size: 10px;
          }

          .n-slider-rail {
            @apply rounded-full !important;
          }

          .n-slider-fill {
            @apply rounded-full !important;
            box-shadow: 0 0 4px rgba(30, 215, 96, 0.5);
          }

          .n-slider-handle {
            @apply transition-all duration-200;
            opacity: 0;
            box-shadow: 0 0 4px rgba(255, 255, 255, 0.7);
          }

          &:hover .n-slider-handle,
          &:active .n-slider-handle {
            opacity: 1;
          }
        }
      }

      .quality-label {
        @apply text-xs text-white opacity-70 mt-1;
      }
    }
  }

  // 主控区
  .player-controls {
    @apply flex items-center justify-between px-8 py-3 relative z-10 pb-8;

    .control-btn {
      @apply flex items-center justify-center cursor-pointer transition;

      i {
        @apply text-white transition-all;
      }

      &.like i {
        @apply text-2xl;
      }

      &.prev i,
      &.next i {
        @apply text-3xl;
      }

      &.play-pause {
        @apply w-12 h-12 rounded-full flex items-center justify-center;
        background: rgba(255, 255, 255, 0.2);

        i {
          @apply text-4xl;
        }
      }

      &.list i {
        @apply text-2xl;
      }

      .like-active {
        @apply text-red-500;
      }
    }
  }

  // 迷你模式样式
  .mobile-mini-controls {
    @apply flex items-center justify-between pr-4 mx-3 h-12 rounded-full shadow-lg;
    background: var(--m-surface, #eae6df);

    .mini-song-info {
      @apply flex items-center flex-1 min-w-0 cursor-pointer;

      .mini-song-cover {
        @apply w-12 h-12 rounded-full;
        border: 8px solid var(--m-surface-alt, #e0dbd3);
      }

      .mini-song-text {
        @apply ml-3 min-w-0 flex-1 flex items-center;

        .mini-song-title {
          @apply text-sm font-medium;
          color: var(--m-text-primary, #2c2c2c);
        }

        .mini-song-artist {
          @apply text-xs;
          color: var(--m-text-muted, #9a9590);
        }
      }
    }

    .mini-playback-controls {
      @apply flex items-center;

      .mini-control-btn {
        @apply flex items-center justify-center cursor-pointer transition;

        &.play {
          @apply w-9 h-9 rounded-full flex items-center justify-center mr-2;

          .iconfont {
            @apply text-xl transition;
            color: var(--accent-color);
          }
        }
      }

      .mini-list-icon {
        @apply text-xl p-1 transition cursor-pointer;
        color: var(--m-text-secondary, #6b6560);

        &:active {
          color: var(--accent-color);
        }
      }
    }
  }
}

.mobile-play-list-container {
  height: 60vh;
  width: 90vw;
  max-width: 400px;
  @apply relative rounded-t-2xl overflow-hidden;

  .mobile-play-list-back {
    backdrop-filter: blur(20px);
    @apply absolute top-0 left-0 w-full h-full;
    @apply bg-light dark:bg-black bg-opacity-90;
  }

  .mobile-play-list-item {
    @apply px-3 py-1;
  }
}
</style>
