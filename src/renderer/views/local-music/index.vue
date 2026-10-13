<template>
  <div class="local-music-page h-full w-full bg-white dark:bg-black transition-colors duration-500">
    <n-scrollbar class="h-full">
      <div class="local-music-content pb-32">
        <!-- Hero Section -->
        <section class="hero-section relative overflow-hidden rounded-tl-2xl">
          <div class="hero-bg absolute inset-0 -top-20">
            <div
              class="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 blur-3xl opacity-50 dark:opacity-30"
            ></div>
            <div
              class="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-black/80 dark:to-black"
            ></div>
          </div>

          <div class="hero-content relative z-10 page-padding-x pt-10 pb-8">
            <div class="flex flex-col md:flex-row gap-8 items-center md:items-end">
              <div class="cover-wrapper relative group">
                <div
                  class="cover-container relative w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-[var(--accent-color)]/10 flex items-center justify-center shadow-2xl ring-4 ring-white/50 dark:ring-neutral-800/50"
                >
                  <i class="ri-folder-music-fill text-6xl text-[var(--accent-color)] opacity-80" />
                </div>
              </div>

              <div class="info-content text-center md:text-left">
                <div class="badge mb-3">
                  <span
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-color)]/10 dark:bg-[var(--accent-color)]/20 text-[var(--accent-color)] text-xs font-semibold uppercase tracking-wider"
                  >
                    {{ t('localMusic.title') }}
                  </span>
                </div>
                <h1
                  class="text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white tracking-tight"
                >
                  {{ t('localMusic.title') }}
                </h1>
                <p class="mt-4 text-sm md:text-base text-neutral-500 dark:text-neutral-400">
                  {{ t('localMusic.songCount', { count: localMusicStore.musicList.length }) }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Action Bar (Sticky) -->
        <section
          class="action-bar sticky top-0 z-20 page-padding-x py-3 md:py-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-neutral-100 dark:border-neutral-800/50"
        >
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <!-- Tabs -->
            <div class="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900 rounded-full p-1">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                class="tab-btn px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                :class="activeTab === tab.key
                  ? 'bg-[var(--accent-color)] text-white shadow-md'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'"
                @click="activeTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>

            <div class="flex items-center gap-3 flex-1 justify-end">
              <!-- Search -->
              <div class="flex-1 max-w-xs min-w-[140px]">
                <n-input
                  v-model:value="searchKeyword"
                  :placeholder="t('localMusic.search')"
                  clearable
                  size="small"
                  round
                >
                  <template #prefix>
                    <i class="ri-search-line text-neutral-400" />
                  </template>
                </n-input>
              </div>

              <!-- Sort dropdown (songs tab only) -->
              <n-select
                v-if="activeTab === 'songs' || detailView"
                v-model:value="sortKey"
                :options="sortOptions"
                size="small"
                class="w-32"
              />

              <!-- Play all -->
              <button
                v-if="displayedList.length > 0"
                class="action-btn-pill flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all bg-[var(--accent-color)] text-white hover:bg-[var(--accent-color)]/90"
                @click="handlePlayAll"
              >
                <i class="ri-play-fill text-lg" />
                <span class="hidden md:inline">{{ t('localMusic.playAll') }}</span>
              </button>

              <!-- Scan -->
              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                :disabled="localMusicStore.scanning"
                @click="handleScan"
              >
                <i
                  class="ri-refresh-line text-lg"
                  :class="{ 'animate-spin': localMusicStore.scanning }"
                />
              </button>

              <!-- Add folder -->
              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                @click="handleAddFolder"
              >
                <i class="ri-folder-add-line text-lg" />
              </button>

              <!-- Add lyrics dir -->
              <button
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                :disabled="localMusicStore.musicList.length === 0"
                @click="handleAddLyricDir"
              >
                <i class="ri-file-music-line text-lg" />
              </button>

              <!-- Folder manager -->
              <button
                v-if="localMusicStore.folderPaths.length > 0"
                class="action-btn-icon w-10 h-10 rounded-full flex items-center justify-center bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all"
                @click="showFolderManager = true"
              >
                <i class="ri-folder-settings-line text-lg" />
              </button>
            </div>
          </div>
        </section>

        <!-- Scanning progress -->
        <section v-if="localMusicStore.scanning" class="page-padding-x mt-6">
          <div
            class="flex items-center gap-4 p-4 rounded-2xl bg-[var(--accent-color)]/5 dark:bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20"
          >
            <n-spin size="small" />
            <div>
              <p class="text-sm font-medium text-neutral-900 dark:text-white">
                {{ t('localMusic.scanning') }}
              </p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {{ t('localMusic.songCount', { count: localMusicStore.scanProgress }) }}
              </p>
            </div>
          </div>
        </section>

        <!-- Main Content -->
        <section class="list-section page-padding-x mt-6">
          <!-- Empty state -->
          <div
            v-if="!localMusicStore.scanning && localMusicStore.musicList.length === 0"
            class="empty-state py-20 text-center"
          >
            <i class="ri-folder-music-fill text-5xl mb-4 text-neutral-200 dark:text-neutral-800" />
            <p class="text-neutral-400">{{ t('localMusic.emptyState') }}</p>
            <button
              class="mt-6 px-6 py-2 rounded-full bg-[var(--accent-color)] text-white text-sm font-medium hover:bg-[var(--accent-color)]/90 transition-all"
              @click="handleAddFolder"
            >
              <i class="ri-folder-add-line mr-2" />
              {{ t('localMusic.scanFolder') }}
            </button>
          </div>

          <!-- No results -->
          <div
            v-else-if="displayedList.length === 0"
            class="empty-state py-20 text-center"
          >
            <i class="ri-search-line text-5xl mb-4 text-neutral-200 dark:text-neutral-800" />
            <p class="text-neutral-400">{{ t('localMusic.search') }}</p>
          </div>

          <!-- ===== Songs Tab / Detail View ===== -->
          <div v-else-if="activeTab === 'songs' || detailView" class="song-list-container">
            <!-- Detail header (when viewing artist/album songs) -->
            <div v-if="detailView" class="detail-header mb-6">
              <button
                class="back-btn flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-[var(--accent-color)] transition-colors mb-4"
                @click="exitDetailView"
              >
                <i class="ri-arrow-left-line text-lg" />
                {{ t('localMusic.backToList') }}
              </button>
              <div class="flex items-center gap-4">
                <div
                  class="w-16 h-16 rounded-2xl flex items-center justify-center bg-[var(--accent-color)]/10"
                >
                  <i
                    :class="detailType === 'artist' ? 'ri-user-3-fill' : 'ri-disc-line'"
                    class="text-3xl text-[var(--accent-color)]"
                  />
                </div>
                <div>
                  <h2 class="text-xl font-bold text-neutral-900 dark:text-white">
                    {{ detailName }}
                  </h2>
                  <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    {{ t('localMusic.songCount', { count: displayedList.length }) }}
                  </p>
                </div>
              </div>
            </div>

            <n-virtual-list
              class="song-virtual-list"
              style="max-height: calc(100vh - 320px)"
              :items="displayedSongResults"
              :item-size="70"
              item-resizable
              key-field="id"
            >
              <template #default="{ item, index }">
                <div>
                  <song-item :item="item" :index="index" @play="handlePlaySong" />
                  <div v-if="index === displayedSongResults.length - 1" class="h-36"></div>
                </div>
              </template>
            </n-virtual-list>
          </div>

          <!-- ===== Artists Tab ===== -->
          <div v-else-if="activeTab === 'artists'" class="artist-grid">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              <button
                v-for="artist in artistList"
                :key="artist.name"
                class="artist-card group flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all"
                @click="enterDetailView('artist', artist.name)"
              >
                <div
                  class="w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-[var(--accent-color)]/20 to-[var(--accent-color)]/5 text-2xl font-bold text-[var(--accent-color)]"
                >
                  {{ artist.name.charAt(0).toUpperCase() }}
                </div>
                <div class="text-center w-full">
                  <p class="text-sm font-medium text-neutral-900 dark:text-white truncate">
                    {{ artist.name }}
                  </p>
                  <p class="text-xs text-neutral-400 mt-0.5">
                    {{ artist.count }} {{ t('localMusic.tabSongs') }}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <!-- ===== Albums Tab ===== -->
          <div v-else-if="activeTab === 'albums'" class="album-grid">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              <button
                v-for="album in albumList"
                :key="album.name"
                class="album-card group flex flex-col gap-3 p-3 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all"
                @click="enterDetailView('album', album.name)"
              >
                <div class="album-cover relative aspect-square rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                  <img
                    v-if="album.cover"
                    :src="album.cover"
                    :alt="album.name"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--accent-color)]/20 to-[var(--accent-color)]/5"
                  >
                    <i class="ri-disc-line text-3xl text-[var(--accent-color)] opacity-60" />
                  </div>
                </div>
                <div class="text-center w-full">
                  <p class="text-sm font-medium text-neutral-900 dark:text-white truncate">
                    {{ album.name }}
                  </p>
                  <p class="text-xs text-neutral-400 mt-0.5 truncate">
                    {{ album.artist }}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </section>
      </div>
    </n-scrollbar>

    <!-- Folder manager drawer -->
    <n-drawer v-model:show="showFolderManager" :width="400" placement="right">
      <n-drawer-content :title="t('localMusic.removeFolder')" closable>
        <div class="space-y-3 py-4">
          <div
            v-for="folder in localMusicStore.folderPaths"
            :key="folder"
            class="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800"
          >
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <i class="ri-folder-line text-lg text-[var(--accent-color)] flex-shrink-0" />
              <span class="text-sm text-neutral-700 dark:text-neutral-300 truncate">{{
                folder
              }}</span>
            </div>
            <button
              class="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0 ml-2"
              @click="handleRemoveFolder(folder)"
            >
              <i class="ri-delete-bin-line" />
            </button>
          </div>

          <div v-if="localMusicStore.folderPaths.length === 0" class="text-center py-8">
            <i class="ri-folder-line text-4xl text-neutral-200 dark:text-neutral-800" />
            <p class="text-sm text-neutral-400 mt-2">{{ t('localMusic.emptyState') }}</p>
          </div>
        </div>

        <template #footer>
          <n-button type="primary" block @click="handleAddFolder">
            <template #icon>
              <i class="ri-folder-add-line" />
            </template>
            {{ t('localMusic.scanFolder') }}
          </n-button>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import { createDiscreteApi } from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import SongItem from '@/components/common/SongItem.vue';
import { usePlaylistConfirm } from '@/hooks/usePlaylistConfirm';
import { useLocalMusicStore } from '@/store/modules/localMusic';
import { usePlayerStore } from '@/store/modules/player';
import type { SongResult } from '@/types/music';
import type { LocalMusicEntry } from '@/types/localMusic';
import { filterByKeyword, sortMusicList, toSongResult } from '@/utils/localMusicUtils';
import type { SortKey } from '@/utils/localMusicUtils';

// ==================== Stores ====================
const { t } = useI18n();
const { message } = createDiscreteApi(['message']);
const localMusicStore = useLocalMusicStore();
const playerStore = usePlayerStore();
const { confirmPlaylistReplace } = usePlaylistConfirm();

// ==================== State ====================
const searchKeyword = ref('');
const showFolderManager = ref(false);
const activeTab = ref<'songs' | 'artists' | 'albums'>('songs');
const sortKey = ref<SortKey>('default');
const detailView = ref(false);
const detailType = ref<'artist' | 'album' | null>(null);
const detailName = ref('');

// ==================== Computed ====================
type TabKey = 'songs' | 'artists' | 'albums';
type SortOption = { label: string; value: SortKey };

const tabs = computed<{ key: TabKey; label: string }[]>(() => [
  { key: 'songs', label: t('localMusic.tabSongs') },
  { key: 'artists', label: t('localMusic.tabArtists') },
  { key: 'albums', label: t('localMusic.tabAlbums') }
]);

const sortOptions = computed<SortOption[]>(() => [
  { label: t('localMusic.sortDefault'), value: 'default' },
  { label: t('localMusic.sortTitle'), value: 'title' },
  { label: t('localMusic.sortArtist'), value: 'artist' },
  { label: t('localMusic.sortAlbum'), value: 'album' },
  { label: t('localMusic.sortYear'), value: 'year' },
  { label: t('localMusic.sortDuration'), value: 'duration' }
]);

/** Filtered + sorted list based on search keyword and detail view */
const filteredList = computed<LocalMusicEntry[]>(() => {
  let list = localMusicStore.musicList;

  // Filter by detail view (artist/album)
  if (detailView.value && detailType.value) {
    if (detailType.value === 'artist') {
      list = list.filter((e) => e.artist === detailName.value);
    } else if (detailType.value === 'album') {
      list = list.filter((e) => e.album === detailName.value);
    }
  }

  // Filter by search keyword
  list = filterByKeyword(list, searchKeyword.value);

  // Sort
  list = sortMusicList(list, sortKey.value);

  return list;
});

/** For songs tab without detail: use filtered + sorted list */
const displayedList = computed<LocalMusicEntry[]>(() => filteredList.value);

const displayedSongResults = computed<SongResult[]>(() => {
  return displayedList.value.map(toSongResult);
});

/** Artist list for artists tab */
const artistList = computed<{ name: string; count: number }[]>(() => {
  const map = new Map<string, number>();
  const keyword = searchKeyword.value.trim().toLowerCase();
  for (const entry of localMusicStore.musicList) {
    if (keyword && !entry.artist.toLowerCase().includes(keyword)) continue;
    const name = entry.artist || t('localMusic.unknownArtist');
    map.set(name, (map.get(name) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
});

/** Album list for albums tab */
const albumList = computed<{ name: string; artist: string; cover: string | null; count: number }[]>(() => {
  const map = new Map<string, { artist: string; cover: string | null; count: number }>();
  const keyword = searchKeyword.value.trim().toLowerCase();
  for (const entry of localMusicStore.musicList) {
    if (keyword && !entry.album.toLowerCase().includes(keyword) && !entry.artist.toLowerCase().includes(keyword)) continue;
    const name = entry.album || t('localMusic.unknownAlbum');
    const existing = map.get(name);
    if (existing) {
      existing.count++;
      if (!existing.cover && entry.cover) existing.cover = entry.cover;
    } else {
      map.set(name, { artist: entry.artist, cover: entry.cover, count: 1 });
    }
  }
  return Array.from(map.entries())
    .map(([name, info]) => ({ name, ...info }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
});

// ==================== Watchers ====================
watch(activeTab, () => {
  // Reset detail view when switching tabs
  detailView.value = false;
  detailType.value = null;
  detailName.value = '';
});

// ==================== Methods ====================
function enterDetailView(type: 'artist' | 'album', name: string): void {
  detailType.value = type;
  detailName.value = name;
  detailView.value = true;
  sortKey.value = type === 'album' ? 'album' : 'default';
}

function exitDetailView(): void {
  detailView.value = false;
  detailType.value = null;
  detailName.value = '';
  sortKey.value = 'default';
}

async function handleAddFolder(): Promise<void> {
  try {
    const result = await window.electron.ipcRenderer.invoke('select-directory');
    if (result && !result.canceled && result.filePaths?.length > 0) {
      localMusicStore.addFolder(result.filePaths[0]);
      await localMusicStore.scanFolders();
    }
  } catch (error) {
    console.error('Failed to select folder:', error);
    message.error(String(error));
  }
}

async function handleAddLyricDir(): Promise<void> {
  try {
    const result = await window.electron.ipcRenderer.invoke('select-directory');
    if (!result || result.canceled || !result.filePaths?.length) return;
    const dirPath = result.filePaths[0];

    message.loading('正在扫描歌词文件...');
    const bindResult = await localMusicStore.bindLyricsFromDirectory(dirPath);

    if (bindResult.matched > 0) {
      message.success(`成功绑定 ${bindResult.matched} 首歌词（共扫描 ${bindResult.total} 个文件）`);
    } else if (bindResult.total > 0) {
      message.warning(`扫描到 ${bindResult.total} 个歌词文件，但未匹配到本地歌曲`);
    } else {
      message.info('该目录下没有找到歌词文件');
    }
  } catch (error) {
    console.error('Failed to add lyric directory:', error);
    message.error('添加歌词目录失败');
  }
}

function handleRemoveFolder(folder: string): void {
  localMusicStore.removeFolder(folder);
}

async function handleScan(): Promise<void> {
  if (localMusicStore.folderPaths.length === 0) {
    await handleAddFolder();
    return;
  }
  await localMusicStore.scanFolders();
}

async function handlePlaySong(_song: SongResult): Promise<void> {
  confirmPlaylistReplace(() => {
    playerStore.setPlayList(displayedSongResults.value);
  });
}

async function handlePlayAll(): Promise<void> {
  if (displayedSongResults.value.length === 0) return;

  confirmPlaylistReplace(async () => {
    try {
      const firstSong = displayedSongResults.value[0];
      const entry = displayedList.value[0];

      const exists = await window.electron.ipcRenderer.invoke('check-file-exists', entry.filePath);
      if (!exists) {
        message.error(t('localMusic.fileNotFound'));
        return;
      }

      playerStore.setPlayList(displayedSongResults.value);
      await playerStore.setPlay(firstSong);
    } catch (error) {
      console.error('Failed to play all:', error);
    }
  });
}

// ==================== Lifecycle ====================
onMounted(async () => {
  await localMusicStore.loadFromCache();
});
</script>

<style scoped>
.song-virtual-list {
  @apply w-full;
}

.song-virtual-list :deep(.n-virtual-list__scroll) {
  scrollbar-width: thin;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar {
  width: 6px;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar-thumb {
  @apply bg-neutral-300 dark:bg-neutral-700 rounded-full;
}

.song-virtual-list :deep(.n-virtual-list__scroll)::-webkit-scrollbar-track {
  @apply bg-transparent;
}
</style>
