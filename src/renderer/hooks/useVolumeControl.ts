/**
 * 音量控制 Hook
 */
import { computed, ref } from 'vue';

import { usePlayerStore } from '@/store/modules/player';

export function useVolumeControl() {
  const playerStore = usePlayerStore();
  const isMuted = ref(false);

  const volumeSlider = computed({
    get: () => playerStore.volume * 100,
    set: (value) => {
      playerStore.setVolume(value / 100);
      isMuted.value = false;
    }
  });

  const volumeIcon = computed(() => {
    const v = playerStore.volume ?? 1;
    if (v === 0 || isMuted.value) return 'ri-volume-mute-fill';
    if (v <= 0.5) return 'ri-volume-down-fill';
    return 'ri-volume-up-fill';
  });

  const mute = () => {
    if (volumeSlider.value === 0) {
      volumeSlider.value = 30;
    } else {
      volumeSlider.value = 0;
    }
  };

  const handleVolumeWheel = (e: WheelEvent) => {
    const delta = e.deltaY < 0 ? 5 : -5;
    const newValue = Math.min(Math.max(volumeSlider.value + delta, 0), 100);
    volumeSlider.value = newValue;
  };

  return {
    volumeSlider,
    volumeIcon,
    isMuted,
    mute,
    handleVolumeWheel
  };
}
