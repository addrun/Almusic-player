<template>
  <div class="search-result-page h-full w-full page-bg transition-colors duration-500">
    <n-scrollbar class="h-full" @scroll="handleScroll">
      <div class="search-result-content pb-32">
        <!-- Header Section -->
        <section class="header-section page-padding-x pt-8 pb-6">
          <div class="flex flex-col gap-6">
            <div>
              <h1 ref="titleElRef" class="d-page-title mb-1">
                {{ currentKeyword }}
              </h1>
              <p class="d-page-subtitle">
                {{ t('search.title.searchList') }}
              </p>
            </div>

            <!-- Search Type Tabs -->
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              <button
                v-for="type in searchTypeOptions"
                :key="type.key"
                class="d-chip"
                :class="{ 'd-chip-active': searchType === type.key }"
                @click="handleTypeChange(type.key)"
              >
                {{ type.label }}
              </button>
            </div>

            <!-- Source Filter (仅单曲搜索时显示) -->
            <div
              v-if="bindingTarget && searchType === SEARCH_TYPE.MUSIC"
              class="d-surface p-4 rounded-xl"
            >
              <p class="text-sm">为歌单中的「{{ bindingTarget.name }}」选择音源</p>
              <p class="text-xs d-text-muted mt-1">
                先试听，确认是需要的版本后点击“用于原歌单”。以后在原歌单中播放会使用该版本。
              </p>
              <div v-if="boundVersion" class="flex items-center gap-3 mt-2 text-xs">
                <span
                  >已指定：{{ boundVersion.name }} ·
                  {{ boundVersion.ar.map((artist) => artist.name).join(' / ') }}</span
                >
                <button class="d-btn-ghost" @click="resetBoundVersion">恢复自动匹配</button>
              </div>
            </div>
            <div
              v-if="searchType === SEARCH_TYPE.MUSIC && searchDetail?.songs?.length"
              class="flex items-center gap-2 flex-wrap"
            >
              <span class="text-xs d-text-muted shrink-0">
                {{ t('search.filter.source') }}
              </span>
              <div class="flex items-center gap-1.5 flex-wrap">
                <button
                  v-for="opt in sourceFilterOptions"
                  :key="opt.key"
                  class="d-chip d-chip-sm"
                  :class="{ 'd-chip-active': activeSourceFilter === opt.key }"
                  @click="activeSourceFilter = opt.key"
                >
                  <span
                    v-if="opt.key !== 'all' && opt.key !== 'pending'"
                    class="w-1.5 h-1.5 rounded-full"
                    :style="{ backgroundColor: opt.color }"
                  ></span>
                  {{ opt.label }}
                  <span class="opacity-60">{{ opt.count }}</span>
                </button>
              </div>
              <!-- 探测进度 -->
              <span
                v-if="probeProgress.total > 0 && probeProgress.done < probeProgress.total"
                class="text-[10px] d-text-muted ml-1 flex items-center gap-1"
              >
                <i class="ri-loader-4-line animate-spin text-xs"></i>
                {{
                  t('search.filter.probeProgress', {
                    done: probeProgress.done,
                    total: probeProgress.total
                  })
                }}
              </span>
              <!-- 跨平台搜索加载提示 -->
              <span
                v-if="crossSearchLoading"
                class="text-[10px] ml-1 flex items-center gap-1"
                style="color: var(--accent-color)"
              >
                <i class="ri-loader-4-line animate-spin text-xs"></i>
                {{ t('search.crossSearch.loading') }}
              </span>
            </div>
          </div>
        </section>

        <!-- Action Bar (Sticky) -->
        <section
          v-if="searchDetail?.songs?.length && searchType === SEARCH_TYPE.MUSIC"
          class="action-bar sticky top-0 z-20 page-padding-x py-3 d-sticky-bar"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <!-- Play All Button -->
              <button class="d-btn-primary" @click="handlePlayAll">
                <i class="ri-play-circle-line text-lg" />
                <span>{{ t('search.button.playAll') }}</span>
              </button>

              <!-- Batch Actions -->
              <div v-if="isElectron" class="d-divider-vertical mx-1 hidden md:block"></div>

              <button v-if="!isSelecting && isElectron" class="d-btn-icon" @click="startSelect">
                <i class="ri-checkbox-multiple-line text-lg" />
              </button>

              <div
                v-if="isSelecting"
                class="flex items-center gap-2 animate-in fade-in slide-in-from-left-2"
              >
                <n-checkbox
                  :checked="isAllSelected"
                  :indeterminate="isIndeterminate"
                  @update:checked="handleSelectAll"
                >
                  {{ t('common.selectAll') }}
                </n-checkbox>
                <button
                  class="d-btn-ghost"
                  :disabled="selectedSongs.length === 0 || isDownloading"
                  @click="handleBatchDownload"
                >
                  <i class="ri-download-line mr-1" />
                  {{ t('favorite.download', { count: selectedSongs.length }) }}
                </button>
                <button class="text-xs d-text-muted hover:d-text-primary" @click="cancelSelect">
                  {{ t('common.cancel') }}
                </button>
              </div>
            </div>

            <!-- Right Tools -->
            <div class="flex items-center gap-3">
              <!-- Layout Toggle -->
              <button v-if="!isMobile" class="d-btn-icon" @click="toggleLayout">
                <i :class="isCompactLayout ? 'ri-list-check-2' : 'ri-grid-line'" class="text-lg" />
              </button>
            </div>
          </div>
        </section>

        <!-- Results Section -->
        <section class="results-section page-padding-x mt-6">
          <n-spin :show="searchDetailLoading">
            <div
              v-if="searchDetailLoading && !isLoadingMore"
              class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              <div v-for="i in 12" :key="i" class="space-y-3">
                <div class="aspect-square skeleton-shimmer rounded-2xl" />
                <div class="h-4 w-3/4 skeleton-shimmer rounded-lg" />
              </div>
            </div>

            <template v-else>
              <!-- Music List Style (Songs) -->
              <div v-if="searchType === SEARCH_TYPE.MUSIC" class="song-results-list">
                <div
                  v-for="(item, index) in filteredSongs"
                  :key="item.id"
                  class="mb-2 animate-item relative"
                  :style="{ animationDelay: calculateAnimationDelay(index % 30, 0.04) }"
                >
                  <!-- 来源标签 -->
                  <span
                    v-if="getSourceLabel(item.id)"
                    class="absolute right-2 top-2 z-10 px-1.5 py-0.5 rounded text-[10px] font-medium pointer-events-none"
                    :style="getSourceBadgeStyle(item.id)"
                  >
                    {{ getSourceLabel(item.id) }}
                  </span>
                  <song-item
                    :index="index"
                    :item="formatSong(item)"
                    :compact="isCompactLayout"
                    :selectable="isSelecting"
                    :selected="selectedSongs.includes(item.id)"
                    :is-next="true"
                    @play="handlePlay"
                    @select="(id, selected) => handleSelect(id, selected)"
                  />
                  <div v-if="bindingTarget" class="flex justify-end px-3 pb-2">
                    <button class="d-btn-ghost text-xs" @click.stop="useVersionForPlaylist(item)">
                      <i class="ri-link mr-1" />用于原歌单
                    </button>
                  </div>
                </div>
              </div>

              <!-- Grid Style (Albums, Playlists, MVs, Radios) -->
              <div v-else>
                <!-- MV Grid (Needs fewer columns) -->
                <div
                  v-if="searchType === SEARCH_TYPE.MV"
                  class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                >
                  <div
                    v-for="(item, index) in searchDetail?.mvs"
                    :key="item.id"
                    class="animate-item"
                    :style="{ animationDelay: calculateAnimationDelay(index % 30, 0.04) }"
                  >
                    <search-item :item="item" />
                  </div>
                </div>

                <!-- Others (Albums, Playlists, Radios) -->
                <div
                  v-else
                  class="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                >
                  <template v-for="(list, key) in searchDetail" :key="key">
                    <template
                      v-if="
                        key.toString() !== 'songs' &&
                        key.toString() !== 'djRadios' &&
                        key.toString() !== 'mvs'
                      "
                    >
                      <div
                        v-for="(item, index) in list"
                        :key="item.id"
                        class="animate-item"
                        :style="{ animationDelay: calculateAnimationDelay(index % 30, 0.04) }"
                      >
                        <search-item :item="item" />
                      </div>
                    </template>

                    <!-- Handle djRadios specifically if they are in searchDetail -->
                    <template v-if="key.toString() === 'djRadios'">
                      <div
                        v-for="(item, index) in searchDetail.djRadios"
                        :key="item.id"
                        class="animate-item"
                        :style="{ animationDelay: calculateAnimationDelay(index % 30, 0.04) }"
                      >
                        <search-item :item="item" />
                      </div>
                    </template>
                  </template>
                </div>
              </div>

              <!-- Empty State -->
              <div v-if="!searchDetailLoading && isResultEmpty" class="d-empty-state">
                <i class="ri-search-line"></i>
                <p>{{ t('comp.musicList.noSearchResults') }}</p>
              </div>

              <!-- Loading More / Footer -->
              <div class="mt-12 py-8 d-divider">
                <div v-if="isLoadingMore" class="flex flex-col items-center gap-4">
                  <n-spin size="small" />
                  <span class="d-footer-text">
                    {{ t('search.loading.more') }}
                  </span>
                </div>
                <div v-if="!hasMore && !isResultEmpty" class="text-center">
                  <span class="d-footer-text opacity-50"> 「{{ t('search.noMore') }}」</span>
                </div>
              </div>
            </template>
          </n-spin>
        </section>
      </div>
    </n-scrollbar>
    <play-bottom />
  </div>
</template>

<script lang="ts" setup>
import { useDateFormat } from '@vueuse/core';
import { useMessage } from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { crossPlatformSearch } from '@/api/crossPlatformSearch';
import { getSearch } from '@/api/search';
import PlayBottom from '@/components/common/PlayBottom.vue';
import SearchItem from '@/components/common/SearchItem.vue';
import SongItem from '@/components/common/SongItem.vue';
import { SEARCH_TYPE, SEARCH_TYPES } from '@/const/bar-const';
import { useDownload } from '@/hooks/useDownload';
import { usePlaylistConfirm } from '@/hooks/usePlaylistConfirm';
import { useScrollTitle } from '@/hooks/useScrollTitle';
import { playbackRequestManager } from '@/services/playbackRequestManager';
import { preloadService } from '@/services/preloadService';
import {
  clearProbeCache,
  getCachedLabel,
  probeSongsBatch,
  quickClassify,
  setLabel,
  SOURCE_LABEL_CONFIG,
  type SourceLabel
} from '@/services/sourceProbeService';
import { usePlayerStore } from '@/store/modules/player';
import { useSearchStore } from '@/store/modules/search';
import type { SongResult } from '@/types/music';
import { calculateAnimationDelay, isElectron, isMobile } from '@/utils';
import {
  clearKugouPlaybackBinding,
  getKugouPlaybackBinding,
  setKugouPlaybackBinding
} from '@/utils/kugouPlaybackBinding';

defineOptions({
  name: 'SearchResult'
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const { confirmPlaylistReplace } = usePlaylistConfirm();
const searchStore = useSearchStore();
const message = useMessage();
const bindingRevision = ref(0);
const bindingTarget = computed(() => {
  const target = searchStore.kugouBindingTarget;
  return target &&
    route.query.kugouTarget === String(target.id) &&
    route.query.keyword === searchStore.kugouBindingKeyword
    ? target
    : null;
});
const boundVersion = computed(() => {
  void bindingRevision.value;
  return bindingTarget.value ? getKugouPlaybackBinding(bindingTarget.value) : null;
});

function clearOriginalPlaybackCache(original: SongResult): void {
  const requestId = playbackRequestManager.getCurrentRequestId();
  if (requestId && playbackRequestManager.getRequest(requestId)?.song.id === original.id) {
    playbackRequestManager.cancelRequest(requestId);
  }
  if (playerStore.playMusic.id === original.id) {
    void playerStore.handlePause();
    playerStore.playMusic.isFirstPlay = true;
  }
  preloadService.cancel(original.id);
  for (const song of [
    ...playerStore.playList,
    ...playerStore.originalPlayList,
    playerStore.playMusic
  ]) {
    if (song?.id === original.id) {
      song.playMusicUrl = undefined;
      song.expiredAt = undefined;
    }
  }
  original.playMusicUrl = undefined;
  original.expiredAt = undefined;
}

function useVersionForPlaylist(item: SongResult): void {
  const original = bindingTarget.value;
  if (!original) return;
  try {
    setKugouPlaybackBinding(original, item);
    clearOriginalPlaybackCache(original);
    bindingRevision.value++;
    message.success('已用于原歌单，下次播放会使用这个版本');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存音源失败，请重试');
  }
}

function resetBoundVersion(): void {
  const original = bindingTarget.value;
  if (!original) return;
  try {
    clearKugouPlaybackBinding(original);
    clearOriginalPlaybackCache(original);
    bindingRevision.value++;
    message.success('已恢复自动匹配');
  } catch {
    message.error('保存失败，请重试');
  }
}

const formatSong = (item: any) => {
  if (!item) return null;
  return {
    ...item,
    picUrl: item.al?.picUrl || item.picUrl,
    song: {
      artists: item.ar || item.artists,
      name: item.name,
      id: item.id
    }
  };
};

const searchDetail = ref<any>();
const searchType = computed(() => searchStore.searchType as number);
const searchDetailLoading = ref(false);

// ==================== 来源筛选状态 ====================
const activeSourceFilter = ref<SourceLabel | 'all'>('all');
const probeProgress = ref({ done: 0, total: 0 });
const sourceLabelVersion = ref(0); // 触发响应式更新
const crossSearchLoading = ref(false); // 跨平台搜索加载状态

const ITEMS_PER_PAGE = 30;
const page = ref(0);
const hasMore = ref(true);
const isLoadingMore = ref(false);
const currentKeyword = computed(() => (route.query.keyword as string) || '');

const titleElRef = ref<HTMLElement | null>(null);
useScrollTitle(currentKeyword, titleElRef);

const searchTypeOptions = computed(() => {
  return SEARCH_TYPES.map((type) => ({
    label: t(type.label),
    key: type.key
  }));
});

const isResultEmpty = computed(() => {
  if (!searchDetail.value) return false;
  return Object.values(searchDetail.value).every((list: any) => !list || list.length === 0);
});

const isSelecting = ref(false);
const selectedSongs = ref<number[]>([]);
const { isDownloading, batchDownloadMusic } = useDownload();
const isCompactLayout = ref(
  isMobile.value ? false : localStorage.getItem('musicListLayout') === 'compact'
);

const startSelect = () => {
  isSelecting.value = true;
  selectedSongs.value = [];
};

const cancelSelect = () => {
  isSelecting.value = false;
  selectedSongs.value = [];
};

const handleSelect = (id: number, selected: boolean) => {
  if (selected) {
    if (!selectedSongs.value.includes(id)) {
      selectedSongs.value.push(id);
    }
  } else {
    selectedSongs.value = selectedSongs.value.filter((i) => i !== id);
  }
};

const isAllSelected = computed(
  () =>
    searchDetail.value?.songs?.length > 0 &&
    selectedSongs.value.length === searchDetail.value.songs.length
);

const isIndeterminate = computed(
  () =>
    selectedSongs.value.length > 0 &&
    selectedSongs.value.length < (searchDetail.value?.songs?.length || 0)
);

const handleSelectAll = (checked: boolean) => {
  selectedSongs.value = checked ? searchDetail.value.songs.map((s: any) => s.id) : [];
};

const handleBatchDownload = async () => {
  const list = selectedSongs.value
    .map((id) => searchDetail.value.songs.find((s: any) => s.id === id))
    .filter((s) => s)
    .map(formatSong) as SongResult[];
  await batchDownloadMusic(list);
  cancelSelect();
};

const toggleLayout = () => {
  isCompactLayout.value = !isCompactLayout.value;
  localStorage.setItem('musicListLayout', isCompactLayout.value ? 'compact' : 'normal');
};

const loadSearch = async (isLoadMore = false) => {
  const keywords = currentKeyword.value;
  if (!keywords) return;

  const type = searchType.value;

  if (!isLoadMore) {
    searchDetail.value = undefined;
    page.value = 0;
    hasMore.value = true;
    searchDetailLoading.value = true;
    // 新搜索清除旧探测缓存和筛选状态
    clearProbeCache();
    activeSourceFilter.value = 'all';
    probeProgress.value = { done: 0, total: 0 };
    crossSearchLoading.value = false;
  } else {
    if (isLoadingMore.value || !hasMore.value) return;
    isLoadingMore.value = true;
  }

  try {
    const { data } = await getSearch({
      keywords,
      type,
      limit: ITEMS_PER_PAGE,
      offset: page.value * ITEMS_PER_PAGE
    });

    const songs = data.result.songs || [];
    const albums = data.result.albums || [];
    const mvs = (data.result.mvs || []).map((item: any) => ({
      ...item,
      picUrl: item.cover,
      playCount: item.playCount,
      desc: item.artists.map((artist: any) => artist.name).join('/'),
      type: 'mv'
    }));

    const playlists = (data.result.playlists || []).map((item: any) => ({
      ...item,
      picUrl: item.coverImgUrl,
      playCount: item.playCount,
      desc: item.creator.nickname,
      type: 'playlist'
    }));

    const djRadios = (data.result.djRadios || []).map((item: any) => ({
      ...item,
      picUrl: item.picUrl,
      desc: item.dj.nickname,
      type: 'djRadio'
    }));

    songs.forEach((item: any) => {
      item.picUrl = item.al.picUrl;
      item.artists = item.ar;
    });
    albums.forEach((item: any) => {
      item.type = '专辑';
      item.desc = `${item.artist.name} ${item.company} ${dateFormat(item.publishTime)}`;
    });

    if (isLoadMore && searchDetail.value) {
      searchDetail.value.songs = [...(searchDetail.value.songs || []), ...songs];
      searchDetail.value.albums = [...(searchDetail.value.albums || []), ...albums];
      searchDetail.value.mvs = [...(searchDetail.value.mvs || []), ...mvs];
      searchDetail.value.playlists = [...(searchDetail.value.playlists || []), ...playlists];
      searchDetail.value.djRadios = [...(searchDetail.value.djRadios || []), ...djRadios];
    } else {
      searchDetail.value = { songs, albums, mvs, playlists, djRadios };
    }

    // 对新加载的歌曲触发来源探测（仅单曲类型）
    if (searchType.value === SEARCH_TYPE.MUSIC && songs.length > 0) {
      probeSources(songs);
    }

    // ==================== 跨平台补充搜索 ====================
    // 单曲搜索、第一页时始终触发跨平台搜索（并发进行，不阻塞网易云结果展示）
    // 跨平台搜索结果会异步合并进来，去重逻辑保证不重复
    if (searchType.value === SEARCH_TYPE.MUSIC && !isLoadMore) {
      triggerCrossPlatformSearch(keywords, songs);
    }

    hasMore.value =
      songs.length === ITEMS_PER_PAGE ||
      albums.length === ITEMS_PER_PAGE ||
      mvs.length === ITEMS_PER_PAGE ||
      playlists.length === ITEMS_PER_PAGE ||
      djRadios.length === ITEMS_PER_PAGE;

    page.value++;
  } catch (error) {
    console.error(t('search.error.searchFailed'), error);
  } finally {
    searchDetailLoading.value = false;
    isLoadingMore.value = false;
  }
};

const handleTypeChange = (type: number) => {
  searchStore.searchType = type;
  router.replace({
    path: '/search-result',
    query: {
      ...route.query,
      type
    }
  });
};

const handleScroll = (e: any) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoadingMore.value && hasMore.value) {
    loadSearch(true);
  }
};

const dateFormat = (time: any) => useDateFormat(time, 'YYYY.MM.DD').value;

// ==================== 来源筛选逻辑 ====================
/**
 * 获取歌曲的来源标签文本（响应式，依赖 sourceLabelVersion）
 */
const getSourceLabel = (songId: number | string): string | null => {
  // 触发依赖追踪
  void sourceLabelVersion.value;
  const label = getCachedLabel(songId);
  if (!label || label === 'pending') return null;
  return SOURCE_LABEL_CONFIG[label].text;
};

/**
 * 获取歌曲来源徽章样式
 */
const getSourceBadgeStyle = (songId: number | string): Record<string, string> => {
  const label = getCachedLabel(songId);
  if (!label || label === 'pending') return {};
  const config = SOURCE_LABEL_CONFIG[label];
  return {
    color: config.color,
    backgroundColor: config.bg
  };
};

/**
 * 按来源筛选后的歌曲列表
 */
const filteredSongs = computed(() => {
  const songs = searchDetail.value?.songs || [];
  if (activeSourceFilter.value === 'all') return songs;
  void sourceLabelVersion.value;
  return songs.filter((song: any) => getCachedLabel(song.id) === activeSourceFilter.value);
});

/**
 * 来源筛选选项（动态生成）
 */
const sourceFilterOptions = computed(() => {
  const songs = searchDetail.value?.songs || [];
  void sourceLabelVersion.value;
  const counts = new Map<SourceLabel, number>();
  let pendingCount = 0;

  for (const song of songs) {
    const label = getCachedLabel(song.id);
    if (label && label !== 'pending') {
      counts.set(label, (counts.get(label) || 0) + 1);
    } else {
      pendingCount++;
    }
  }

  const options: Array<{ key: SourceLabel | 'all'; label: string; count: number; color?: string }> =
    [{ key: 'all', label: t('search.filter.all'), count: songs.length }];

  for (const [label, count] of counts) {
    options.push({
      key: label,
      label: SOURCE_LABEL_CONFIG[label].text,
      count,
      color: SOURCE_LABEL_CONFIG[label].color
    });
  }

  // 未探测完的歌曲归入 pending
  if (pendingCount > 0) {
    options.push({
      key: 'pending',
      label: t('search.filter.probing'),
      count: pendingCount,
      color: SOURCE_LABEL_CONFIG.pending.color
    });
  }

  return options;
});

/**
 * 对搜索结果进行来源探测
 * 先用 quickClassify 即时标注，再对 pending 的歌曲懒探测
 */
const probeSources = (songs: any[]) => {
  if (!songs || songs.length === 0) return;

  // 第一层：即时分类（零请求）
  for (const song of songs) {
    const existing = getCachedLabel(song.id);
    if (!existing) {
      const label = quickClassify(song);
      setLabel(song.id, label);
    }
  }
  sourceLabelVersion.value++;

  // 第二层：对 pending 的歌曲懒探测（需要解锁的无版权歌曲）
  const toProbe = songs.filter((song: any) => {
    const label = getCachedLabel(song.id);
    return label === 'pending';
  });

  if (toProbe.length === 0) return;

  // 转换为 SongResult 格式
  const songResults = toProbe.map(formatSong).filter(Boolean) as SongResult[];

  probeProgress.value = { done: 0, total: songResults.length };

  probeSongsBatch(
    songResults,
    (done, total) => {
      probeProgress.value = { done, total };
      sourceLabelVersion.value++;
    },
    () => {
      // 单首探测完成，触发响应式更新
      sourceLabelVersion.value++;
    }
  );
};

/**
 * 触发跨平台补充搜索
 * 当网易云搜索结果不足时，调用 GD 音乐台 joox 音源搜索 QQ 独占内容
 */
const triggerCrossPlatformSearch = async (keyword: string, neteaseSongs: any[]) => {
  crossSearchLoading.value = true;
  try {
    // 将网易云歌曲转换为 SongResult 格式用于去重
    const existingSongs = neteaseSongs.map(formatSong).filter(Boolean) as SongResult[];

    const crossResults = await crossPlatformSearch(keyword, existingSongs);

    if (crossResults.length > 0 && searchDetail.value) {
      // 合并跨平台结果到歌曲列表
      searchDetail.value.songs = [...(searchDetail.value.songs || []), ...crossResults];

      // 对跨平台歌曲触发来源标注（即时分类，无需网络探测）
      probeSources(crossResults);

      sourceLabelVersion.value++;
    }
  } catch (error) {
    console.error(t('search.crossSearch.failed'), error);
  } finally {
    crossSearchLoading.value = false;
  }
};

const handlePlay = (item: any) => {
  playerStore.addToNextPlay(item);
};

const handlePlayAll = () => {
  if (!searchDetail.value?.songs?.length) return;
  const songs = searchDetail.value.songs.map(formatSong);
  confirmPlaylistReplace(() => {
    playerStore.setPlayList(songs);
    if (songs[0]) {
      playerStore.setPlay(songs[0]);
    }
  });
};

onMounted(() => {
  if (route.query.type) {
    searchStore.searchType = Number(route.query.type);
  }
  if (currentKeyword.value) {
    loadSearch();
  }
});

watch(
  () => [route.query.keyword, route.query.type],
  () => {
    if (route.name === 'searchResult') {
      if (route.query.type) {
        searchStore.searchType = Number(route.query.type);
      }
      loadSearch();
    }
  }
);
</script>

<style lang="scss" scoped>
.search-result-page {
  position: relative;
}

.animate-item {
  animation: fadeInUp 0.6s var(--d-ease-out) backwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
</style>
