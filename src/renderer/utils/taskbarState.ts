import { watch } from 'vue';

import type { SongResult } from '@/types/music';

import {
  TASKBAR_REQUEST_CHANNEL,
  TASKBAR_STATE_CHANNEL,
  type TaskbarState,
  taskbarText
} from '../../shared/taskbar';
import { getSongFavoriteId } from './songFavorite';

export interface TaskbarRendererBridge {
  send: (channel: string, state: TaskbarState) => void;
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
}

export function projectTaskbarState(
  song: SongResult | null | undefined,
  playing: boolean,
  isFavorite: (id: string | number) => boolean
): TaskbarState {
  const id = getSongFavoriteId(song);
  const artists = song?.ar?.length ? song.ar : song?.artists || song?.song?.artists || [];
  return {
    songId: id === null ? null : String(id),
    title: id === null ? '' : taskbarText(song?.name || ''),
    artist:
      id === null
        ? ''
        : taskbarText(
            artists
              .map((artist: { name: string }) => artist.name || '')
              .filter(Boolean)
              .join(' / ')
          ),
    isPlaying: id !== null && playing,
    isFavorite: id !== null && isFavorite(id),
    canFavorite: id !== null,
    favoriteIsLocal: typeof id === 'string'
  };
}

/** Watch both the track and the collection so UI, keyboard and native buttons stay in sync. */
export function synchronizeTaskbarState(
  bridge: TaskbarRendererBridge,
  state: () => TaskbarState
): () => void {
  const sendState = () => bridge.send(TASKBAR_STATE_CHANNEL, state());
  const removeListener = bridge.on(TASKBAR_REQUEST_CHANNEL, sendState);
  const stopWatch = watch(state, (value) => bridge.send(TASKBAR_STATE_CHANNEL, value), {
    immediate: true
  });
  return () => {
    stopWatch();
    removeListener();
  };
}
