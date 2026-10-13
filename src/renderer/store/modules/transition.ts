/**
 * Transition Store — crossfade 过渡 UI 状态
 *
 * 在 Smart Mix crossfade 期间，为 PlayBar / MusicFull 等组件提供
 * 下一首的视觉信息（背景色、封面、歌名、艺术家），使 UI 能在
 * 音频过渡的同时做平滑的视觉渐变。
 *
 * 生命周期：
 *   audioService 'crossfade-start'  → begin(track)
 *   audioService 'crossfade-complete' → end()
 *   audioService 'crossfade-cancelled' → end()
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

import type { Artist, SongResult } from '@/types/music';

export const useTransitionStore = defineStore('transition', () => {
  // ==================== State ====================

  /** 是否正在 crossfade 过渡（UI 层用） */
  const isCrossfadingUI = ref(false);

  /** 下一首背景色 */
  const nextBackgroundColor = ref<string>('');

  /** 下一首封面 URL */
  const nextCoverUrl = ref<string>('');

  /** 下一首歌曲名 */
  const nextName = ref<string>('');

  /** 下一首艺术家 */
  const nextArtist = ref<string>('');

  /** 过渡时长（秒），由 crossfade-start 事件携带 */
  const duration = ref<number>(8);

  // ==================== Actions ====================

  /**
   * 开始过渡：设置下一首信息并标记 UI 过渡状态
   * 由 MusicHook 在 'crossfade-start' 事件中调用
   */
  const begin = (track: SongResult, crossfadeDuration: number = 8) => {
    isCrossfadingUI.value = true;
    nextBackgroundColor.value = track.backgroundColor || '';
    nextCoverUrl.value = track.picUrl || '';
    nextName.value = track.name || '';
    duration.value = crossfadeDuration || 8;

    // 解析艺术家名
    const artists: Artist[] | undefined =
      track.ar || track.song?.artists;
    if (artists && artists.length > 0) {
      nextArtist.value = artists.map((a) => a.name).join(' / ');
    } else {
      nextArtist.value = '';
    }
  };

  /**
   * 结束过渡：清除 UI 过渡状态
   * 由 MusicHook 在 'crossfade-complete' / 'crossfade-cancelled' 事件中调用
   */
  const end = () => {
    isCrossfadingUI.value = false;
    nextBackgroundColor.value = '';
    nextCoverUrl.value = '';
    nextName.value = '';
    nextArtist.value = '';
    duration.value = 8;
  };

  return {
    // state
    isCrossfadingUI,
    nextBackgroundColor,
    nextCoverUrl,
    nextName,
    nextArtist,
    duration,
    // actions
    begin,
    end,
  };
});
