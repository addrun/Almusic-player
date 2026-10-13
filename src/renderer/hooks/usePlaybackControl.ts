/**
 * 播放控制 Hook
 */
import { computed } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { audioService } from '@/services/audioService';
import { usePlayerStore } from '@/store/modules/player';

export function usePlaybackControl() {
  const playerStore = usePlayerStore();

  const isPlaying = computed(() => playerStore.isPlay);

  const playMusicEvent = async () => {
    try {
      const result = await playerStore.setPlay({ ...playMusic.value });
      if (result) {
        playerStore.setPlayMusic(true);
      }
    } catch (error) {
      console.error('播放失败:', error);
    }
  };

  const handleNext = () => {
    playerStore.nextPlay();
  };

  const handlePrev = () => {
    playerStore.prevPlay();
  };

  return {
    isPlaying,
    playMusicEvent,
    handleNext,
    handlePrev
  };
}
