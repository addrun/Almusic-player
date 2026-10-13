import type { SongResult } from '@/types/music';

const STORAGE_KEY = 'kugouPlaybackBindings.v1';
const SUPPORTED_PLATFORMS = new Set(['netease', 'qq', 'migu', 'kugou', 'kuwo', 'joox']);

function bindingKey(song: SongResult): string | null {
  if (!song.kugou || song.platform !== 'kugou' || !/^[a-f0-9]{32}$/i.test(song.platformId || ''))
    return null;
  return song.platformId!.toUpperCase();
}

/** Persist catalogue identity only. Signed URLs, account data and nested song objects are excluded. */
function catalogueSong(value: unknown): SongResult | null {
  if (!value || typeof value !== 'object') return null;
  const song = value as SongResult;
  const platform = song.platform || 'netease';
  if (!SUPPORTED_PLATFORMS.has(platform) || !song.name || typeof song.name !== 'string')
    return null;
  if (platform === 'netease') {
    if (!Number.isSafeInteger(Number(song.id)) || Number(song.id) <= 0) return null;
  } else if (
    !song.platformId ||
    typeof song.platformId !== 'string' ||
    song.platformId.length > 256
  ) {
    return null;
  }
  const artistValues = Array.isArray(song.ar)
    ? song.ar
    : Array.isArray(song.artists)
      ? song.artists
      : [];
  const artists = artistValues
    .filter((artist) => typeof artist?.name === 'string')
    .slice(0, 16)
    .map((artist) => ({ id: 0, name: artist.name.slice(0, 200) })) as SongResult['ar'];
  if (!artists.length) return null;
  const duration = Number(song.dt || song.duration || 0);
  return {
    id: platform === 'netease' ? Number(song.id) : `${platform}:${song.platformId}`,
    name: song.name.slice(0, 500),
    ar: artists,
    al: {
      id: 0,
      name: typeof song.al?.name === 'string' ? song.al.name.slice(0, 500) : ''
    } as SongResult['al'],
    picUrl: '',
    count: 0,
    platform,
    platformId: platform === 'netease' ? undefined : song.platformId,
    dt: Number.isFinite(duration) && duration > 0 ? duration : 0
  };
}

function readBindings(): Record<string, unknown> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // An unavailable or damaged local preference must not prevent normal playback.
  }
  return {};
}

export function getKugouPlaybackBinding(song: SongResult): SongResult | null {
  const key = bindingKey(song);
  return key ? catalogueSong(readBindings()[key]) : null;
}

/** A user-selected version may have a different title or uploader. Never infer this binding. */
export function setKugouPlaybackBinding(original: SongResult, candidate: SongResult): void {
  const key = bindingKey(original);
  const selected = catalogueSong(candidate);
  if (!key || !selected) throw new Error('这个搜索结果无法用于原歌单');
  const bindings = readBindings();
  bindings[key] = selected;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

export function clearKugouPlaybackBinding(original: SongResult): void {
  const key = bindingKey(original);
  if (!key) return;
  const bindings = readBindings();
  delete bindings[key];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}
