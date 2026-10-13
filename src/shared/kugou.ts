/** Public data returned by the main-process Kugou service. Login tokens never cross IPC. */
export interface KugouProfile {
  userId: string;
  nickname: string;
  avatarUrl?: string;
}

export interface KugouStatus {
  loggedIn: boolean;
  profile?: KugouProfile;
  persistenceAvailable: boolean;
  cacheAvailable: boolean;
  syncing: boolean;
  lastSyncAt?: number;
  warning?: string;
}

export interface KugouLoginQr {
  sessionId: string;
  url: string;
  imageDataUrl?: string;
  expiresAt: number;
}

export interface KugouLoginCheck {
  state: 'waiting' | 'scanned' | 'confirmed' | 'expired';
  status?: KugouStatus;
}

export type KugouPlaylistCategory = 'liked' | 'created' | 'collected';

export interface KugouTrack {
  id: string;
  hash: string;
  name: string;
  artists: Array<{ id?: string; name: string }>;
  albumId?: string;
  albumName: string;
  coverUrl?: string;
  durationMs: number;
  albumAudioId?: string;
  fileId?: string;
  /**
   * Collection/add time of this entry in its source playlist, when Kugou
   * returns collecttime. Public collected playlists can expose the owner's
   * entry time; this is not necessarily when the current user saved the list.
   */
  addedAtMs?: number;
  /**
   * Verified per-user cloud listening count, if a future read source supplies
   * it. Current playlist endpoints do not establish this value; absence means
   * unknown, not zero. Never substitute public heat or a playlist-wide count.
   */
  personalPlayCount?: number;
  unavailable?: boolean;
}

export interface KugouPlaylist {
  /** Local account-scoped stable identifier; used by playlist-tracks IPC. */
  id: string;
  listId: string;
  type: 0 | 1;
  globalCollectionId?: string;
  name: string;
  coverUrl?: string;
  category: KugouPlaylistCategory;
  ownerName?: string;
  /** Reported cloud count, when provided by Kugou. */
  trackCount?: number;
  fetchedTrackCount: number;
  complete: boolean;
  warnings: string[];
}

export interface KugouLibrary {
  profile: KugouProfile;
  playlists: KugouPlaylist[];
  syncedAt: number;
  /** True only when both the playlist catalogue and every playlist finished. */
  complete: boolean;
  expectedPlaylistCount?: number;
  warnings: string[];
}

export interface KugouPlaylistTracks {
  playlist: KugouPlaylist;
  tracks: KugouTrack[];
}

export interface KugouSyncProgress {
  stage: 'playlists' | 'tracks' | 'finished';
  completedPlaylists: number;
  totalPlaylists: number;
  currentPlaylist?: string;
  fetchedTracks: number;
  message: string;
}

export interface KugouSongUrlRequest {
  hash: string;
  albumId?: string;
  albumAudioId?: string;
  /** Account privileges apply; requests never explicitly enable free-part previews. */
  quality?: '128' | '320' | 'flac' | 'high';
}

export interface KugouSongUrl {
  url: string;
  bitrate?: number;
}

export interface KugouLyricsRequest {
  hash: string;
  name?: string;
  durationMs?: number;
}

export interface KugouLyrics {
  lyric: string;
}

/**
 * Invoke channels:
 * kugou:status () -> KugouStatus
 * kugou:login-create () -> KugouLoginQr
 * kugou:login-check (sessionId: string) -> KugouLoginCheck
 * kugou:login-cancel (sessionId: string) -> boolean
 * kugou:logout () -> KugouStatus
 * kugou:library () -> KugouLibrary | null
 * kugou:sync () -> KugouLibrary (all pages of all playlists; persisted locally)
 * kugou:playlist-tracks (playlistId: string, refresh?: boolean) -> KugouPlaylistTracks
 * kugou:song-url (request: KugouSongUrlRequest) -> KugouSongUrl
 * kugou:lyrics (request: KugouLyricsRequest) -> KugouLyrics
 * Event: kugou:sync-progress (progress: KugouSyncProgress)
 */
