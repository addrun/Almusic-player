/**
 * 歌词背景 Hook
 */
import { ref, watch } from 'vue';

import { playMusic } from '@/hooks/MusicHook';
import { getImgUrl, getTextColors } from '@/utils';

export function useLyricBackground(options?: { isDark?: boolean }) {
  const currentBackground = ref('#000');
  const isDark = ref(options?.isDark ?? false);

  const applyBackground = (background: string) => {
    currentBackground.value = background;
    const colors = getTextColors(background);
    isDark.value = colors.theme === 'dark';

    document.documentElement.style.setProperty('--text-color-primary', colors.primary);
    document.documentElement.style.setProperty('--text-color-active', colors.active);
    document.documentElement.style.setProperty('--hover-bg-color', colors.hoverBg);
  };

  watch(
    () => playMusic.value?.backgroundColor,
    (bg) => {
      if (bg) {
        applyBackground(bg as string);
      }
    },
    { immediate: true }
  );

  return {
    currentBackground,
    isDark,
    applyBackground
  };
}
