import { ref } from 'vue';

import type { SongResult } from '@/types/music';
import type { LocalFavoriteSongs } from '@/utils/localFavoriteSongs';
import type { FavoriteSongId } from '@/utils/songFavorite';

interface FavoriteSongsSources {
  favoriteIds: () => readonly FavoriteSongId[];
  localSongs: () => LocalFavoriteSongs;
  descending: () => boolean;
  loadNeteaseSongs: (ids: number[]) => Promise<SongResult[]>;
  pageSize?: number;
  previewLimit?: number;
}

/** A mixed-platform page consumes favorite IDs, including IDs with missing details. */
export function useFavoriteSongs(sources: FavoriteSongsSources) {
  const favoriteSongs = ref<SongResult[]>([]);
  const loading = ref(false);
  const noMore = ref(false);
  const loadError = ref('');
  const currentPage = ref(0);
  const pageSize = sources.pageSize || 100;
  let requestEpoch = 0;
  let alive = true;

  const loadNextPage = async () => {
    if (
      !alive ||
      loading.value ||
      noMore.value ||
      (sources.previewLimit && favoriteSongs.value.length >= sources.previewLimit)
    ) {
      return;
    }
    const epoch = ++requestEpoch;
    const ids = [...sources.favoriteIds()];
    if (sources.descending()) ids.reverse();
    const localSongs = sources.localSongs();

    loading.value = true;
    loadError.value = '';
    try {
      // Old favorite IDs may have no saved details. Skip empty pages so the next
      // playable page remains reachable even when there is nothing to scroll.
      while (alive && epoch === requestEpoch) {
        const page = currentPage.value;
        const currentIds = ids.slice(page * pageSize, (page + 1) * pageSize);
        if (!currentIds.length) {
          noMore.value = true;
          return;
        }
        const musicIds = currentIds.filter((id): id is number => typeof id === 'number');
        let neteaseSongs: SongResult[] = [];
        let failed = false;
        if (musicIds.length) {
          try {
            neteaseSongs = await sources.loadNeteaseSongs(musicIds);
          } catch {
            failed = true;
          }
        }
        if (!alive || epoch !== requestEpoch) return;

        const neteaseById = new Map(neteaseSongs.map((song) => [String(song.id), song]));
        const songs = currentIds
          .map((id) =>
            typeof id === 'number'
              ? neteaseById.get(String(id))
              : Object.hasOwn(localSongs, id)
                ? localSongs[id]
                : undefined
          )
          .filter((song): song is SongResult => Boolean(song));
        const combined = page === 0 ? songs : [...favoriteSongs.value, ...songs];
        favoriteSongs.value = sources.previewLimit
          ? combined.slice(0, sources.previewLimit)
          : combined;
        currentPage.value = page + 1;
        noMore.value = currentPage.value * pageSize >= ids.length;
        if (failed) loadError.value = '部分网易云收藏暂时无法加载，请重试。';
        if (songs.length || noMore.value || failed) break;
      }
    } finally {
      if (alive && epoch === requestEpoch) loading.value = false;
    }
  };

  const reload = () => {
    requestEpoch++;
    favoriteSongs.value = [];
    currentPage.value = 0;
    noMore.value = false;
    loadError.value = '';
    loading.value = false;
    return loadNextPage();
  };

  const dispose = () => {
    alive = false;
    requestEpoch++;
  };

  return { favoriteSongs, loading, noMore, loadError, loadNextPage, reload, dispose };
}
