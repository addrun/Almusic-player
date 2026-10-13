import type { SongResult } from '@/types/music';

export type FavoriteSongId = string | number;
export type FavoriteSongInput = Pick<SongResult, 'id'> & Partial<SongResult>;

export interface SongFavoriteActions {
  isFavorite: (id: FavoriteSongId) => boolean;
  addToFavorite: (id: FavoriteSongId) => unknown;
  removeFromFavorite: (id: FavoriteSongId) => unknown;
  rememberSong?: (song: FavoriteSongInput) => void;
}

/** Keep platform and local IDs intact; only real NetEase numeric IDs use its account API. */
export function getSongFavoriteId(
  song: Pick<SongResult, 'id' | 'platform'> | null | undefined
): FavoriteSongId | null {
  const id = song?.id;
  if (typeof id !== 'string' && typeof id !== 'number') return null;
  if (typeof id === 'number' && (!Number.isSafeInteger(id) || id <= 0)) return null;
  if (typeof id === 'string' && !id.trim()) return null;

  const otherPlatform = song?.platform && song.platform !== 'netease';
  if (otherPlatform) {
    // Existing cross-platform search and Kugou imports already namespace their IDs.
    return typeof id === 'string' ? id : `${song.platform}:${id}`;
  }
  if (typeof id === 'number') return id;
  if (/^\d+$/.test(id)) {
    const numericId = Number(id);
    return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null;
  }
  return id;
}

export async function toggleSongFavorite(
  song: FavoriteSongInput | null | undefined,
  favorites: SongFavoriteActions
): Promise<{ id: FavoriteSongId; wasFavorite: boolean } | null> {
  const id = getSongFavoriteId(song);
  if (id === null) return null;
  const wasFavorite = favorites.isFavorite(id);
  if (wasFavorite) await favorites.removeFromFavorite(id);
  else {
    // Store clean playback metadata before publishing a cross-platform favorite ID.
    if (typeof id === 'string' && song) favorites.rememberSong?.(song);
    await favorites.addToFavorite(id);
  }
  return { id, wasFavorite };
}
