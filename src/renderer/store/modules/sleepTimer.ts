import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import i18n from '@/../i18n/renderer';
import { getLocalStorageItem, setLocalStorageItem } from '@/utils/playerUtils';

// 定时关闭类型
export enum SleepTimerType {
  NONE = 'none',
  TIME = 'time',
  SONGS = 'songs',
  PLAYLIST_END = 'end'
}

// 定时关闭信息
export interface SleepTimerInfo {
  type: SleepTimerType;
  value: number;
  endTime?: number;
  startSongIndex?: number;
  remainingSongs?: number;
}

/**
 * 定时关闭管理 Store
 * 负责：定时关闭功能
 */
export const useSleepTimerStore = defineStore('sleepTimer', () => {
  // ==================== 状态 ====================
  const sleepTimer = ref<SleepTimerInfo>(
    getLocalStorageItem('sleepTimer', {
      type: SleepTimerType.NONE,
      value: 0
    })
  );
  const showSleepTimer = ref(false);
  const timerInterval = ref<number | null>(null);

  // ==================== Computed ====================
  const currentSleepTimer = computed(() => sleepTimer.value);
  const hasSleepTimerActive = computed(() => sleepTimer.value.type !== SleepTimerType.NONE);

  const sleepTimerRemainingTime = computed(() => {
    if (sleepTimer.value.type === SleepTimerType.TIME && sleepTimer.value.endTime) {
      const remaining = Math.max(0, sleepTimer.value.endTime - Date.now());
      return Math.ceil(remaining / 60000);
    }
    return 0;
  });

  const sleepTimerRemainingSongs = computed(() => {
    if (sleepTimer.value.type === SleepTimerType.SONGS) {
      return sleepTimer.value.remainingSongs || 0;
    }
    return 0;
  });

  // ==================== Actions ====================

  /**
   * 按时间设置定时关闭
   */
  const setSleepTimerByTime = (minutes: number) => {
    clearSleepTimer();

    if (minutes <= 0) {
      return false;
    }

    const endTime = Date.now() + minutes * 60 * 1000;

    sleepTimer.value = {
      type: SleepTimerType.TIME,
      value: minutes,
      endTime
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    timerInterval.value = window.setInterval(() => {
      checkSleepTimer();
    }, 1000) as unknown as number;

    return true;
  };

  /**
   * 按歌曲数设置定时关闭
   */
  const setSleepTimerBySongs = async (songs: number) => {
    clearSleepTimer();

    if (songs <= 0) {
      return false;
    }

    const { usePlaylistStore } = await import('./playlist');
    const playlistStore = usePlaylistStore();

    sleepTimer.value = {
      type: SleepTimerType.SONGS,
      value: songs,
      startSongIndex: playlistStore.playListIndex,
      remainingSongs: songs
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    return true;
  };

  /**
   * 播放列表结束时关闭
   */
  const setSleepTimerAtPlaylistEnd = () => {
    clearSleepTimer();

    sleepTimer.value = {
      type: SleepTimerType.PLAYLIST_END,
      value: 0
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    return true;
  };

  /**
   * 取消定时关闭
   */
  const clearSleepTimer = () => {
    if (timerInterval.value) {
      window.clearInterval(timerInterval.value);
      timerInterval.value = null;
    }

    sleepTimer.value = {
      type: SleepTimerType.NONE,
      value: 0
    };

    setLocalStorageItem('sleepTimer', sleepTimer.value);

    return true;
  };

  /**
   * 检查定时关闭是否应该触发
   */
  const checkSleepTimer = () => {
    if (sleepTimer.value.type === SleepTimerType.NONE) {
      return;
    }

    if (sleepTimer.value.type === SleepTimerType.TIME && sleepTimer.value.endTime) {
      if (Date.now() >= sleepTimer.value.endTime) {
        stopPlayback();
      }
    }
  };

  /**
   * 停止播放并清除定时器
   */
  const stopPlayback = async () => {

    const { usePlayerCoreStore } = await import('./playerCore');
    const playerCore = usePlayerCoreStore();
    const { audioService } = await import('@/services/audioService');

    if (playerCore.isPlaying) {
      playerCore.setIsPlay(false);
      audioService.pause();
    }

    // 发送通知
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('show-notification', {
        title: i18n.global.t('player.sleepTimer.timerEnded'),
        body: i18n.global.t('player.sleepTimer.playbackStopped')
      });
    }

    clearSleepTimer();
  };

  /**
   * 监听歌曲变化，处理按歌曲数定时和播放列表结束定时
   */
  const handleSongChange = async () => {

    // 处理按歌曲数定时
    if (
      sleepTimer.value.type === SleepTimerType.SONGS &&
      sleepTimer.value.remainingSongs !== undefined
    ) {
      sleepTimer.value.remainingSongs--;

      setLocalStorageItem('sleepTimer', sleepTimer.value);

      if (sleepTimer.value.remainingSongs <= 0) {
        stopPlayback();
        setTimeout(() => {
          stopPlayback();
        }, 1000);
      }
    }

    // 处理播放列表结束定时
    if (sleepTimer.value.type === SleepTimerType.PLAYLIST_END) {
      const { usePlaylistStore } = await import('./playlist');
      const playlistStore = usePlaylistStore();

      const isLastSong = playlistStore.playListIndex === playlistStore.playList.length - 1;

      if (isLastSong && playlistStore.playMode !== 1) {
        sleepTimer.value = {
          type: SleepTimerType.SONGS,
          value: 1,
          remainingSongs: 1
        };
        setLocalStorageItem('sleepTimer', sleepTimer.value);
      }
    }
  };

  /**
   * 设置定时器弹窗显示状态
   */
  const setShowSleepTimer = (value: boolean) => {
    showSleepTimer.value = value;
  };

  return {
    // 状态
    sleepTimer,
    showSleepTimer,

    // Computed
    currentSleepTimer,
    hasSleepTimerActive,
    sleepTimerRemainingTime,
    sleepTimerRemainingSongs,

    // Actions
    setSleepTimerByTime,
    setSleepTimerBySongs,
    setSleepTimerAtPlaylistEnd,
    clearSleepTimer,
    checkSleepTimer,
    stopPlayback,
    handleSongChange,
    setShowSleepTimer
  };
});
