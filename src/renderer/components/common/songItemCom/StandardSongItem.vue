<template>
  <base-song-item
    :item="item"
    :selectable="selectable"
    :selected="selected"
    :can-remove="canRemove"
    :is-next="isNext"
    :index="index"
    @play="(...args) => $emit('play', ...args)"
    @select="(...args) => $emit('select', ...args)"
    @remove-song="(...args) => $emit('remove-song', ...args)"
    class="standard-song-item"
    ref="baseItem"
  >
    <!-- 选择框插槽-->
    <template #select>
      <div v-if="baseItem && selectable" class="song-item-select" @click.stop="onToggleSelect">
        <n-checkbox :checked="selected" />
      </div>
    </template>

    <!-- 鍥剧墖鎻掓Ы -->
    <template #image>
      <n-image
        v-if="item.picUrl"
        :src="getImgUrl(item.picUrl, '100y100')"
        class="song-item-img"
        preview-disabled
        :img-props="{
          crossorigin: 'anonymous'
        }"
        @load="onImageLoad"
      />
    </template>

    <!-- 鍐呭鎻掓Ы -->
    <template #content>
      <div class="song-item-content">
        <div class="song-item-content-title">
          <n-ellipsis
            class="text-ellipsis"
            line-clamp="1"
            :class="{ 'text-[var(--accent-color)]': isPlaying }"
            >{{ item.name }}</n-ellipsis
          >
        </div>
        <div class="song-item-content-name">
          <n-ellipsis class="text-ellipsis" line-clamp="1">
            <template v-for="(artist, index) in artists" :key="index">
              <span
                class="cursor-pointer hover:text-[var(--accent-color)]"
                @click.stop="onArtistClick(artist.id)"
                >{{ artist.name }}</span
              >
              <span v-if="index < artists.length - 1"> / </span>
            </template>
          </n-ellipsis>
        </div>
        <div v-if="item.al?.name" class="song-item-content-album" @click.stop="onAlbumClick">
          <n-ellipsis class="text-ellipsis" line-clamp="1">{{ item.al.name }}</n-ellipsis>
        </div>
      </div>
    </template>

    <!-- 鎿嶄綔鎻掓Ы -->
    <template #operating>
      <div class="song-item-operating">
        <div v-if="favorite" class="song-item-operating-like">
          <i
            class="iconfont icon-likefill"
            :class="{ 'like-active': isFavorite }"
            @click.stop="onToggleFavorite"
          ></i>
        </div>
        <n-tooltip v-if="isNext" trigger="hover" :z-index="9999999" :delay="400">
          <template #trigger>
            <div class="song-item-operating-next" @click.stop="onPlayNext">
              <i class="iconfont ri-skip-forward-fill"></i>
            </div>
          </template>
          {{ t('songItem.menu.playNext') }}
        </n-tooltip>
        <div
          class="song-item-operating-play animate__animated"
          :class="{ 'is-playing': isPlaying, animate__flipInY: playLoading }"
          @click="onPlayMusic"
        >
          <i v-if="isPlaying && play" class="iconfont icon-stop"></i>
          <i v-else class="iconfont icon-playfill"></i>
        </div>
      </div>
    </template>
  </base-song-item>
</template>

<script lang="ts" setup>
import { NCheckbox, NEllipsis, NImage, NTooltip } from 'naive-ui';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { usePlayerStore } from '@/store';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';

import BaseSongItem from './BaseSongItem.vue';

const { t } = useI18n();
const playerStore = usePlayerStore();

const props = withDefaults(
  defineProps<{
    item: SongResult;
    favorite?: boolean;
    selectable?: boolean;
    selected?: boolean;
    canRemove?: boolean;
    isNext?: boolean;
    index?: number;
  }>(),
  {
    favorite: true,
    selectable: false,
    selected: false,
    canRemove: false,
    isNext: false,
    index: undefined
  }
);

const emit = defineEmits(['play', 'select', 'remove-song']);
const baseItem = ref<InstanceType<typeof BaseSongItem>>();

// 从playerStore和baseItem鑾峰彇鍝嶅簲寮忕姸鎬
const play = computed(() => playerStore.isPlay);
const isPlaying = computed(() => baseItem.value?.isPlaying || false);
const playLoading = computed(() => baseItem.value?.playLoading || false);
const isFavorite = computed(() => baseItem.value?.isFavorite || false);
const artists = computed(() => baseItem.value?.artists || []);

// 鍖呰鏂规硶锛岄伩鍏嶇洿鎺ヨ闂彲鑳戒负undefined的ref
const onToggleSelect = () => {
  baseItem.value?.toggleSelect();
};
const onImageLoad = (event: Event) => baseItem.value?.imageLoad(event);
const onArtistClick = (id: number) => baseItem.value?.handleArtistClick(id);
const onAlbumClick = () => {
  if (props.item.al?.id) {
    baseItem.value?.handleAlbumClick(props.item.al.id);
  }
};
const onToggleFavorite = (event: Event) => {
  baseItem.value?.toggleFavorite(event);
};
const onPlayMusic = () => {
  baseItem.value?.playMusicEvent(props.item);
  emit('play', props.item);
};
const onPlayNext = () => {
  baseItem.value?.handlePlayNext();
};
</script>

<style lang="scss" scoped>
.standard-song-item {
  &:hover {
    background: var(--d-surface-hover);
  }

  .song-item-img {
    @apply w-12 h-12 mr-4;
    border-radius: var(--d-radius-lg);
  }

  .song-item-content {
    @apply flex-1;

    &-title {
      font-size: var(--d-text-base);
      color: var(--d-text-primary);
    }

    &-name {
      font-size: var(--d-text-xs);
      color: var(--d-text-secondary);
    }

    &-album {
      font-size: var(--d-text-xs);
      color: var(--d-text-muted);
      @apply mt-0.5 cursor-pointer;

      &:hover {
        color: var(--accent-color);
      }
    }
  }

  .song-item-operating {
    @apply flex items-center rounded-full ml-4;
    border: 1px solid var(--d-border);
    background: var(--d-surface);

    .iconfont {
      @apply text-xl;
    }

    .icon-likefill {
      @apply text-xl transition;
      color: var(--d-text-secondary);

      &:hover {
        @apply text-red-500;
      }
    }

    &-like {
      @apply mr-2 cursor-pointer ml-4 transition-all;
    }

    &-next {
      @apply mr-2 cursor-pointer transition-all;

      .iconfont {
        @apply text-xl transition;
        color: var(--d-text-secondary);

        &:hover {
          color: var(--accent-color);
        }
      }
    }

    .like-active {
      @apply text-red-500;
    }

    &-play {
      @apply cursor-pointer rounded-full w-10 h-10 flex justify-center items-center transition;
      border: 1px solid var(--d-border);
      color: var(--d-text-primary);
      background: var(--d-surface);

      &:hover {
        background-color: var(--accent-color);
        border-color: var(--accent-color);
        color: white;
      }

      &.is-playing {
        background-color: var(--accent-color);
        border-color: var(--accent-color);
        color: white;
      }
    }
  }

  .song-item-select {
    @apply mr-3 cursor-pointer;
  }
}
</style>
