/**
 * 收藏 Hook
 */
import { computed } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { useFavoriteStore } from '@/store/modules/favorite';
import { getSongFavoriteId, toggleSongFavorite } from '@/utils/songFavorite';

export function useFavorite() {
  const favorites = useFavoriteStore();

  const songId = computed(() => getSongFavoriteId(playMusic.value));

  const isFavorite = computed(() => {
    const id = songId.value;
    return id !== null && favorites.isFavorite(id);
  });

  const toggleFavorite = () => toggleSongFavorite(playMusic.value, favorites);

  return {
    isFavorite,
    toggleFavorite
  };
}
