import type { Artist, SongResult } from '@/types/music';
import { type FavoriteSongInput, getSongFavoriteId } from '@/utils/songFavorite';

export type LocalFavoriteSongs = Record<string, SongResult>;

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, 1024) || fallback : fallback;
}

function identifier(value: unknown): string {
  const id = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  return typeof id === 'string' && /^[\w:-]{1,256}$/.test(id) ? id : '';
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function coverUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
    // Covers need no account, query credentials, or temporary playback signatures.
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}

function artist(value: Partial<Artist>): Artist {
  return {
    name: text(value.name, '未知歌手'),
    id: finiteNumber(value.id) || 0,
    picId: 0,
    img1v1Id: 0,
    briefDesc: '',
    picUrl: '',
    img1v1Url: '',
    albumSize: 0,
    alias: [],
    trans: '',
    musicSize: 0,
    topicPerson: 0
  };
}

/** Keep just the metadata needed to display and resolve a cross-platform track. */
export function cleanLocalFavoriteSong(song: FavoriteSongInput): SongResult | null {
  const id = getSongFavoriteId(song);
  const platform = song.platform;
  if (
    typeof id !== 'string' ||
    !identifier(id) ||
    !platform ||
    platform === 'netease' ||
    !/^[a-z][a-z0-9_-]{0,31}$/i.test(platform)
  ) {
    return null;
  }

  const platformId = identifier(
    song.platformId || (id.startsWith(`${platform}:`) ? id.slice(platform.length + 1) : song.id)
  );
  if (!platformId) return null;

  const sourceArtists = Array.isArray(song.ar) && song.ar.length ? song.ar : song.artists;
  const artists = (Array.isArray(sourceArtists) ? sourceArtists : [])
    .filter((value) => value && typeof value === 'object')
    .slice(0, 32)
    .map(artist);
  if (!artists.length) artists.push(artist({}));
  const sourceAlbum = song.al || song.album;
  const picUrl = coverUrl(song.picUrl || sourceAlbum?.picUrl);
  const album: SongResult['al'] = {
    name: text(sourceAlbum?.name),
    id: finiteNumber(sourceAlbum?.id) || 0,
    type: '',
    size: 0,
    picId: 0,
    blurPicUrl: '',
    companyId: 0,
    pic: 0,
    picUrl,
    publishTime: 0,
    description: '',
    tags: '',
    company: '',
    briefDesc: '',
    artist: artists[0],
    songs: [],
    alias: [],
    status: 0,
    copyrightId: 0,
    commentThreadId: '',
    artists,
    subType: '',
    onSale: false,
    mark: 0,
    picId_str: ''
  };
  const result: SongResult = {
    id,
    name: text(song.name, '未知歌曲'),
    picUrl,
    ar: artists,
    artists,
    al: album,
    album,
    count: finiteNumber(song.count) || 0,
    platform,
    platformId
  };
  const duration = finiteNumber(song.duration);
  const dt = finiteNumber(song.dt);
  if (duration !== undefined) result.duration = duration;
  if (dt !== undefined) result.dt = dt;
  if (platform === 'kugou' && song.kugou) {
    result.kugou = {};
    const albumId = identifier(song.kugou.albumId);
    const albumAudioId = identifier(song.kugou.albumAudioId);
    if (albumId) result.kugou.albumId = albumId;
    if (albumAudioId) result.kugou.albumAudioId = albumAudioId;
    if (typeof song.kugou.unavailable === 'boolean') {
      result.kugou.unavailable = song.kugou.unavailable;
    }
  }
  return result;
}

/** Revalidate persisted data and discard orphaned or malformed snapshots. */
export function restoreLocalFavoriteSongs(
  value: unknown,
  favoriteIds: readonly (string | number)[]
): LocalFavoriteSongs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const ids = new Set(favoriteIds.filter((id): id is string => typeof id === 'string'));
  const entries: Array<[string, SongResult]> = [];
  for (const [key, rawSong] of Object.entries(value)) {
    if (!ids.has(key) || !rawSong || typeof rawSong !== 'object' || Array.isArray(rawSong))
      continue;
    const song = cleanLocalFavoriteSong(rawSong as FavoriteSongInput);
    if (song && song.id === key) entries.push([key, song]);
  }
  return Object.fromEntries(entries);
}
