<template>
  <div v-if="isComponent ? favoriteSongs.length : true" class="favorite-page h-full flex flex-col">
    <!-- Header Section -->
    <div
      class="flex items-center justify-between px-6 py-4 flex-shrink-0"
      :class="setAnimationClass('animate__fadeInLeft')"
    >
      <div class="flex items-center gap-4">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ t('favorite.title') }}
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {{ t('favorite.count', { count: favoriteList.length }) }}
          </p>
        </div>
      </div>

      <div v-if="!isComponent && isElectron" class="flex items-center gap-3">
        <template v-if="!isSelecting">
          <!-- Sort Controls -->
          <div class="flex items-center bg-gray-100 dark:bg-neutral-800 rounded-full p-1 h-9">
            <button
              v-for="isDesc in [true, false]"
              :key="String(isDesc)"
              class="px-3 h-full rounded-full text-xs font-medium transition-all duration-300 flex items-center gap-1"
              :class="
                isDescending === isDesc
                  ? 'bg-white dark:bg-neutral-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              "
              @click="toggleSort(isDesc)"
            >
              <i class="text-sm" :class="isDesc ? 'ri-sort-desc' : 'ri-sort-asc'"></i>
              {{ isDesc ? t('favorite.descending') : t('favorite.ascending') }}
            </button>
          </div>

          <button
            class="h-9 px-4 rounded-full bg-[var(--accent-color)]/10 hover:bg-[var(--accent-color)] text-[var(--accent-color)] hover:text-white text-xs font-medium transition-all duration-300 flex items-center gap-1.5"
            @click="startSelect"
          >
            <i class="ri-checkbox-multiple-line text-sm"></i>
            {{ t('favorite.batchDownload') }}
          </button>
        </template>

        <!-- Selection Controls -->
        <div
          v-else
          class="flex items-center gap-3 bg-white dark:bg-neutral-800 shadow-sm rounded-full px-4 py-1.5 border border-gray-100 dark:border-neutral-700 h-9"
        >
          <n-checkbox
            :checked="isAllSelected"
            :indeterminate="isIndeterminate"
            size="small"
            @update:checked="handleSelectAll"
          >
            <span class="text-xs">{{ t('common.selectAll') }}</span>
          </n-checkbox>
          <div class="h-3 w-px bg-gray-200 dark:bg-neutral-700 mx-1"></div>
          <div class="flex items-center gap-2">
            <button
              class="h-6 px-3 rounded-full bg-primary text-white text-xs font-medium hover:bg-[var(--accent-color)]-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              :disabled="selectedSongs.length === 0"
              @click="handleBatchDownload"
            >
              <i class="ri-download-line"></i>
              {{ t('favorite.download', { count: selectedSongs.length }) }}
            </button>
            <button
              class="h-6 px-3 rounded-full bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-gray-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
              @click="cancelSelect"
            >
              {{ t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-grow min-h-0 px-2" :class="setAnimationClass('animate__bounceInRight')">
      <n-scrollbar ref="scrollbarRef" class="h-full pr-4" @scroll="handleScroll">
        <div
          v-if="favoriteList.length === 0"
          class="h-full flex flex-col items-center justify-center text-gray-400"
        >
          <div
            class="w-24 h-24 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4"
          >
            <i class="ri-heart-line text-4xl text-gray-300 dark:text-gray-600"></i>
          </div>
          <p>{{ t('favorite.emptyTip') }}</p>
        </div>

        <div v-else class="space-y-1 pb-24" :class="{ 'max-w-[400px]': isComponent }">
          <n-alert v-if="loadError" type="warning" :show-icon="false" class="mb-3">
            {{ loadError }}
            <n-button text type="primary" class="ml-2" @click="reloadFavoriteSongs">重试</n-button>
          </n-alert>
          <song-item
            v-for="(song, index) in favoriteSongs"
            :key="song.id"
            :item="song"
            class="rounded-xl hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            :class="[
              setAnimationClass('animate__bounceInLeft'),
              { '!bg-[var(--accent-color)]/10': selectedSongs.includes(song.id) }
            ]"
            :style="getItemAnimationDelay(index)"
            :selectable="isSelecting"
            :selected="selectedSongs.includes(song.id)"
            @play="handlePlay"
            @select="handleSelect"
          />

          <div v-if="isComponent" class="pt-4 text-center">
            <n-button text type="primary" @click="handleMore">
              {{ t('common.viewMore') }} <i class="ri-arrow-right-s-line ml-1"></i>
            </n-button>
          </div>

          <!-- Loading Skeletons -->
          <div v-if="loading" class="space-y-2 pt-2">
            <div
              v-for="i in 5"
              :key="i"
              class="flex items-center gap-4 rounded-xl p-2 animate-pulse"
            >
              <div class="h-12 w-12 rounded-xl bg-gray-200 dark:bg-neutral-800"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-1/3 rounded bg-gray-200 dark:bg-neutral-800"></div>
                <div class="h-3 w-1/4 rounded bg-gray-200 dark:bg-neutral-800"></div>
              </div>
            </div>
          </div>

          <div v-if="!isComponent && !loading && !noMore" class="pt-4 text-center">
            <n-button text type="primary" @click="loadNextPage">加载更多</n-button>
          </div>
          <div v-if="noMore" class="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
            {{ t('common.noMore') }}
          </div>
        </div>
      </n-scrollbar>
      <play-bottom />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getMusicDetail } from '@/api/music';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SongItem from '@/components/common/SongItem.vue';
import { useDownload } from '@/hooks/useDownload';
import { useFavoriteSongs } from '@/hooks/useFavoriteSongs';
import { usePlaylistConfirm } from '@/hooks/usePlaylistConfirm';
import { usePlayerStore } from '@/store';
import { useFavoriteStore } from '@/store/modules/favorite';
import type { SongResult } from '@/types/music';
import { isElectron, setAnimationClass, setAnimationDelay } from '@/utils';
import type { FavoriteSongId } from '@/utils/songFavorite';

const { t } = useI18n();
const playerStore = usePlayerStore();
const favorites = useFavoriteStore();
const { confirmPlaylistReplace } = usePlaylistConfirm();
const favoriteList = computed(() => favorites.favoriteList);
const isDescending = ref(true);
const props = defineProps({
  isComponent: {
    type: Boolean,
    default: false
  }
});
const {
  favoriteSongs,
  loading,
  noMore,
  loadError,
  loadNextPage,
  reload: reloadFavoriteSongs,
  dispose
} = useFavoriteSongs({
  favoriteIds: () => favoriteList.value,
  localSongs: () => favorites.localFavoriteSongs,
  descending: () => isDescending.value,
  previewLimit: props.isComponent ? 16 : undefined,
  loadNeteaseSongs: async (ids) => {
    const response = await getMusicDetail(ids);
    return (response.data.songs || []).map((song: SongResult) => ({
      ...song,
      picUrl: song.al?.picUrl || '',
      source: 'netease'
    }));
  }
});

// 多选相关
const isSelecting = ref(false);
const selectedSongs = ref<FavoriteSongId[]>([]);
const { batchDownloadMusic } = useDownload();

// 开始多选
const startSelect = () => {
  isSelecting.value = true;
  selectedSongs.value = [];
};

// 取消多选
const cancelSelect = () => {
  isSelecting.value = false;
  selectedSongs.value = [];
};

// 处理选择
const handleSelect = (songId: FavoriteSongId, selected: boolean) => {
  if (selected && !selectedSongs.value.includes(songId)) {
    selectedSongs.value.push(songId);
  } else if (!selected) {
    selectedSongs.value = selectedSongs.value.filter((id) => id !== songId);
  }
};

// 批量下载
const handleBatchDownload = async () => {
  // 获取选中歌曲的信息
  const selectedSongsList = selectedSongs.value
    .map((songId) => favoriteSongs.value.find((s) => s.id === songId))
    .filter((song) => song) as SongResult[];

  // 使用hook中的批量下载功能
  await batchDownloadMusic(selectedSongsList);

  // 下载完成后取消选择
  cancelSelect();
};

// 切换排序方式
const toggleSort = (descending: boolean) => {
  if (isDescending.value === descending) return;
  isDescending.value = descending;
};

// 处理滚动事件
const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  const { scrollTop, scrollHeight, clientHeight } = target;
  const threshold = 100; // 距离底部多少像素时加载更多

  if (!loading.value && !noMore.value && scrollHeight - (scrollTop + clientHeight) < threshold) {
    void loadNextPage();
  }
};

let initialized = false;
let alive = true;
onMounted(async () => {
  try {
    await playerStore.initializeFavoriteList();
  } finally {
    if (alive) {
      initialized = true;
      await reloadFavoriteSongs();
    }
  }
});
onBeforeUnmount(() => {
  alive = false;
  dispose();
});

// 监听收藏列表变化，变化时重置并重新加载
watch(
  [favoriteList, () => favorites.localFavoriteSongs, isDescending],
  () => {
    cancelSelect();
    if (initialized) void reloadFavoriteSongs();
  },
  { deep: true, flush: 'sync' }
);

const handlePlay = () => {
  confirmPlaylistReplace(() => {
    playerStore.setPlayList(favoriteSongs.value);
  });
};

const getItemAnimationDelay = (index: number) => {
  return setAnimationDelay(index, 30);
};

const router = useRouter();
const handleMore = () => {
  router.push('/history');
};

// 全选相关
const isAllSelected = computed(() => {
  return (
    favoriteSongs.value.length > 0 && selectedSongs.value.length === favoriteSongs.value.length
  );
});

const isIndeterminate = computed(() => {
  return selectedSongs.value.length > 0 && selectedSongs.value.length < favoriteSongs.value.length;
});

// 处理全选/取消全选
const handleSelectAll = (checked: boolean) => {
  if (checked) {
    selectedSongs.value = favoriteSongs.value.map((song) => song.id);
  } else {
    selectedSongs.value = [];
  }
};
</script>

<style lang="scss" scoped>
/* Scoped styles kept minimal as we use Tailwind classes */
</style>
