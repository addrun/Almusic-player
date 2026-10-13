import { ref, watch } from 'vue';

import { validateColor } from '@/utils/linearColor';

export interface LyricSettings {
  isTop: boolean;
  theme: 'light' | 'dark';
  isLock: boolean;
  highlightColor: string | undefined;
  showTranslation: boolean;
  displayMode: 'scroll' | 'single' | 'double';
  fontFamily: string;
  textColor: string;
  playedColor: string;
  unplayedColor: string;
  strokeColor: string;
  useCoverColor: boolean;
}

export function loadLyricSettings(): LyricSettings {
  try {
    const stored = localStorage.getItem('lyricData');
    if (stored) {
      const parsed = JSON.parse(stored);
      let validatedHighlightColor = parsed.highlightColor;
      if (validatedHighlightColor && !validateColor(validatedHighlightColor)) {
        console.warn('Invalid stored highlight color, removing it');
        validatedHighlightColor = undefined;
      }
      return {
        isTop: parsed.isTop ?? false,
        theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'dark',
        isLock: parsed.isLock ?? false,
        highlightColor: validatedHighlightColor,
        showTranslation: parsed.showTranslation ?? true,
        displayMode: (['scroll', 'single', 'double'].includes(parsed.displayMode)
          ? parsed.displayMode
          : 'scroll') as LyricSettings['displayMode'],
        fontFamily: parsed.fontFamily || '',
        textColor: parsed.textColor || '',
        playedColor: parsed.playedColor || '',
        unplayedColor: parsed.unplayedColor || '',
        strokeColor: parsed.strokeColor || '',
        useCoverColor: parsed.useCoverColor !== false
      };
    }
  } catch (error) {
    console.error('Failed to load lyric settings:', error);
  }
  return {
    isTop: false,
    theme: 'dark',
    isLock: false,
    highlightColor: undefined,
    showTranslation: true,
    displayMode: 'scroll',
    fontFamily: '',
    textColor: '',
    playedColor: '',
    unplayedColor: '',
    strokeColor: '',
    useCoverColor: true
  };
}

function saveLyricSettings(settings: LyricSettings): void {
  try {
    localStorage.setItem('lyricData', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save lyric settings:', error);
  }
}

export function useLyricSettings() {
  const lyricSetting = ref<LyricSettings>(loadLyricSettings());

  watch(
    () => lyricSetting.value,
    (newValue) => {
      saveLyricSettings(newValue);
    },
    { deep: true }
  );

  return {
    lyricSetting,
    loadLyricSettings,
    saveLyricSettings
  };
}
