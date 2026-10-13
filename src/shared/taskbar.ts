/** The taskbar only receives display metadata and booleans, never account or audio URLs. */
export interface TaskbarState {
  songId: string | null;
  title: string;
  artist: string;
  isPlaying: boolean;
  isFavorite: boolean;
  canFavorite: boolean;
  favoriteIsLocal: boolean;
}

export const TASKBAR_STATE_CHANNEL = 'taskbar:update-state';
export const TASKBAR_REQUEST_CHANNEL = 'taskbar:request-state';

export function emptyTaskbarState(): TaskbarState {
  return {
    songId: null,
    title: '',
    artist: '',
    isPlaying: false,
    isFavorite: false,
    canFavorite: false,
    favoriteIsLocal: false
  };
}

export function taskbarText(value: string): string {
  return (
    value
      .replace(/<[^>]*>/g, '')
      // Native shell labels must not contain control characters.
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f]/g, ' ')
      .trim()
      .slice(0, 160)
  );
}

/** Validate IPC again in the main process instead of trusting a renderer cast. */
export function normalizeTaskbarState(value: unknown): TaskbarState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  if (
    (state.songId !== null &&
      (typeof state.songId !== 'string' || !state.songId.trim() || state.songId.length > 512)) ||
    typeof state.title !== 'string' ||
    typeof state.artist !== 'string' ||
    typeof state.isPlaying !== 'boolean' ||
    typeof state.isFavorite !== 'boolean' ||
    typeof state.canFavorite !== 'boolean' ||
    typeof state.favoriteIsLocal !== 'boolean'
  )
    return null;

  const hasSong = state.songId !== null;
  const canFavorite = hasSong && state.canFavorite;
  return {
    songId: state.songId as string | null,
    title: hasSong ? taskbarText(state.title) : '',
    artist: hasSong ? taskbarText(state.artist) : '',
    isPlaying: hasSong && state.isPlaying,
    isFavorite: canFavorite && state.isFavorite,
    canFavorite,
    favoriteIsLocal: canFavorite && state.favoriteIsLocal
  };
}
