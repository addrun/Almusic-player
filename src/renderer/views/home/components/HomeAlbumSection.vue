<template>
  <section class="album-section">
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
      v-else-if="displayAlbums.length > 0"
      :items="gridItems"
      @item-click="handleAlbumClick"
      @item-play="playAlbum"
    />

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-20 text-neutral-400">
      <i class="ri-album-line mb-4 text-5xl opacity-20" />
      <p class="text-sm font-medium">{{ t('comp.newAlbum.empty') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { getTopAlbum } from '@/api/home';
import { getAlbum } from '@/api/list';
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
    limit: 10,
    columns: 5,
    rows: 2
  }
);

defineEmits<{
  (e: 'more'): void;
}>();

const { t } = useI18n();
const router = useRouter();
const albums = ref<any[]>([]);
const loading = ref(true);

const displayCount = computed(() => {
  if (isMobile.value) return 6;
  return props.columns * props.rows;
});

const displayAlbums = computed(() => albums.value);

const gridItems = computed(() => {
  return displayAlbums.value.map((album: any) => ({
    id: album.id,
    name: album.name,
    subtitle: getArtistNames(album),
    cover: album.picUrl || '',
    _raw: album
  }));
});

const fetchAlbums = async () => {
  try {
    const { data } = await getTopAlbum({ limit: props.limit || 20 });
    if (data.code === 200) {
      albums.value = data.weekData || data.monthData || data.albums || [];
    }
  } catch (error) {
    console.error('Failed to fetch albums:', error);
  } finally {
    loading.value = false;
  }
};

const getArtistNames = (album: any) => {
  if (album.artists) return album.artists.map((ar: any) => ar.name).join(' / ');
  if (album.artist) return album.artist.name;
  return '';
};

const handleAlbumClick = async (item: any) => {
  const album = item._raw || item;
  try {
    navigateToMusicList(router, {
      id: album.id,
      type: 'album',
      name: album.name,
      listInfo: { ...album, coverImgUrl: album.picUrl },
      canRemove: false
    });
  } catch (error) {
    console.error('Failed to navigate to album:', error);
  }
};

const playAlbum = async (item: any) => {
  const album = item._raw || item;
  try {
    const { data } = await getAlbum(album.id);
    if (data.code === 200 && data.songs?.length > 0) {
      const playerCore = usePlayerCoreStore();
      const playlistStore = usePlaylistStore();

      const albumCover = data.album?.picUrl || album.picUrl;
      const playlist = data.songs.map((s: any) => ({
        id: s.id,
        name: s.name,
        source: 'netease',
        song: s,
        ...s,
        picUrl: s.al?.picUrl || albumCover,
        playLoading: false
      }));

      playlistStore.setPlayList(playlist, false, false);
      await playerCore.handlePlayMusic(playlist[0], true);
    }
  } catch (error) {
    console.error('Failed to play album:', error);
  }
};

onMounted(() => {
  fetchAlbums();
});
</script>
