<template>
  <section class="playlist-section">
    <!-- Section Header -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl dark:text-white">
          {{ title }}
        </h2>
        <div class="h-1.5 w-1.5 rounded-full bg-[var(--accent-color)]" />
      </div>
      <button
        class="group flex items-center gap-1.5 text-sm font-semibold text-neutral-400 transition-colors hover:text-[var(--accent-color)] dark:text-neutral-500 dark:hover:text-white"
        @click="$emit('more')"
      >
        <span>{{ t('comp.more') }}</span>
        <i class="ri-arrow-right-s-line text-base transition-transform group-hover:translate-x-1" />
      </button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="flex gap-4 overflow-hidden">
      <div v-for="i in 8" :key="i" class="flex-shrink-0">
        <div class="aspect-square skeleton-shimmer rounded-2xl" style="width: 160px; height: 160px;" />
      </div>
    </div>

    <!-- Infinite Cover Grid -->
    <infinite-cover-grid
      v-else-if="displayPlaylists.length > 0"
      :items="gridItems"
      @item-click="handlePlaylistClick"
      @item-play="playPlaylist"
    />

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-20 text-neutral-400">
      <i class="ri-play-list-2-line mb-4 text-5xl opacity-20" />
      <p class="text-sm font-medium">{{ t('comp.recommendSonglist.empty') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getPersonalizedPlaylist } from '@/api/home';
import { getListDetail } from '@/api/list';
import { navigateToMusicList } from '@/components/common/MusicListNavigator';
import { usePlayerCoreStore } from '@/store/modules/playerCore';
import { usePlaylistStore } from '@/store/modules/playlist';
import { isMobile } from '@/utils';

import InfiniteCoverGrid from '@/components/common/InfiniteCoverGrid.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    limit?: number;
    columns?: number;
    rows?: number;
  }>(),
  {
    limit: 15,
    columns: 5,
    rows: 3
  }
);

defineEmits<{
  (e: 'more'): void;
}>();

const { t } = useI18n();
const router = useRouter();
const playlists = ref<any[]>([]);
const loading = ref(true);

const effectiveColumns = computed(() =>
  isMobile.value ? Math.min(2, props.columns) : props.columns
);
const effectiveRows = computed(() => (isMobile.value ? 2 : props.rows));

// Calculate display count to fill exactly N rows
const displayCount = computed(() => effectiveColumns.value * effectiveRows.value);

const displayPlaylists = computed(() => {
  return playlists.value;
});

const gridItems = computed(() => {
  return displayPlaylists.value.map((item: any) => ({
    id: item.id,
    name: item.name,
    subtitle: item.copywriter || '',
    cover: item.picUrl || '',
    _raw: item
  }));
});

const fetchPlaylists = async () => {
  try {
    const { data } = await getPersonalizedPlaylist(props.limit || displayCount.value + 5);
    if (data.code === 200) {
      playlists.value = data.result || [];
    }
  } catch (error) {
    console.error('Failed to fetch playlists:', error);
  } finally {
    loading.value = false;
  }
};

const handlePlaylistClick = async (item: any) => {
  const raw = item._raw || item;
  try {
    navigateToMusicList(router, {
      id: raw.id,
      type: 'playlist',
      name: raw.name,
      listInfo: raw,
      canRemove: false
    });
  } catch (error) {
    console.error('Failed to navigate to playlist:', error);
  }
};

const playPlaylist = async (item: any) => {
  const raw = item._raw || item;
  try {
    const { data } = await getListDetail(raw.id);
    if (data.playlist?.tracks?.length > 0) {
      const playerCore = usePlayerCoreStore();
      const playlistStore = usePlaylistStore();

      const playlist = data.playlist.tracks.map((s: any) => ({
        id: s.id,
        name: s.name,
        picUrl: s.al?.picUrl || raw.picUrl,
        source: 'netease',
        song: s,
        ...s,
        playLoading: false
      }));

      playlistStore.setPlayList(playlist, false, false);
      await playerCore.handlePlayMusic(playlist[0], true);
    }
  } catch (error) {
    console.error('Failed to play playlist:', error);
  }
};

onMounted(() => {
  fetchPlaylists();
});
</script>
