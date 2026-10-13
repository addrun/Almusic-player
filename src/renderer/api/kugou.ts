import type { Artist, SongResult } from '@/types/music';

import type {
  KugouLibrary,
  KugouLoginCheck,
  KugouLoginQr,
  KugouPlaylistTracks,
  KugouStatus,
  KugouSyncProgress,
  KugouTrack
} from '../../shared/kugou';

export type {
  KugouLibrary,
  KugouLoginCheck,
  KugouLoginQr,
  KugouPlaylist,
  KugouPlaylistCategory,
  KugouPlaylistTracks,
  KugouStatus,
  KugouSyncProgress,
  KugouTrack
} from '../../shared/kugou';

interface KugouBridge {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
}

function bridge(): KugouBridge {
  const ipc = (window as Window & { ipcRenderer?: KugouBridge }).ipcRenderer;
  if (!ipc) throw new Error('酷狗歌单同步需要在桌面版中使用');
  return ipc;
}

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return bridge().invoke(channel, ...args) as Promise<T>;
}

/** The account token is held by the main process and never returned to the page. */
export const kugouApi = {
  getStatus: () => invoke<KugouStatus>('kugou:status'),
  createLogin: () => invoke<KugouLoginQr>('kugou:login-create'),
  checkLogin: (sessionId: string) => invoke<KugouLoginCheck>('kugou:login-check', sessionId),
  cancelLogin: (sessionId: string) => invoke<boolean>('kugou:login-cancel', sessionId),
  logout: () => invoke<KugouStatus>('kugou:logout'),
  getLibrary: () => invoke<KugouLibrary | null>('kugou:library'),
  sync: () => invoke<KugouLibrary>('kugou:sync'),
  getPlaylistTracks: (playlistId: string, refresh = false) =>
    invoke<KugouPlaylistTracks>('kugou:playlist-tracks', playlistId, refresh),
  onSyncProgress: (callback: (progress: KugouSyncProgress) => void) =>
    bridge().on('kugou:sync-progress', (progress) => callback(progress as KugouSyncProgress))
};

export function canPlayKugouTrack(track: KugouTrack): boolean {
  return !track.unavailable && /^[a-f0-9]{32}$/i.test(track.hash);
}

export function toKugouSongResult(track: KugouTrack): SongResult {
  const artists: Artist[] = (track.artists.length ? track.artists : [{ name: '未知歌手' }]).map(
    (artist) => ({
      name: artist.name,
      id: 0,
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
    })
  );
  const album: SongResult['al'] = {
    name: track.albumName || '',
    id: 0,
    type: '',
    size: 0,
    picId: 0,
    blurPicUrl: '',
    companyId: 0,
    pic: 0,
    picUrl: track.coverUrl || '',
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
  const hash = track.hash.toUpperCase();
  return {
    id: `kugou:${track.id}`,
    name: track.name || '未知歌曲',
    picUrl: track.coverUrl || '',
    ar: artists,
    artists,
    al: album,
    album,
    duration: track.durationMs,
    dt: track.durationMs,
    count: 0,
    platform: 'kugou',
    platformId: hash,
    kugou: {
      albumId: track.albumId,
      albumAudioId: track.albumAudioId,
      unavailable: !canPlayKugouTrack(track)
    }
  };
}

/** Human-readable IPC failures; do not dump remote responses or login data into the console. */
export function kugouErrorText(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  return (
    error.message
      .replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, '')
      .slice(0, 240) || fallback
  );
}
