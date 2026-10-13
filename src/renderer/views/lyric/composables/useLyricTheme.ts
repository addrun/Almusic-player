import type { Ref } from 'vue';
import { ref } from 'vue';

import {
  getCurrentLyricThemeColor,
  loadLyricThemeColor,
  saveLyricThemeColor,
  validateColor
} from '@/utils/linearColor';

import type { LyricSettings } from './useLyricSettings';

function updateCSSVariable(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function updateThemeColorWithTransition(newColor: string) {
  const lyricWindow = document.querySelector('.lyric-window');
  if (lyricWindow) {
    lyricWindow.classList.add('color-transitioning');
  }
  updateCSSVariable('--lyric-highlight-color', newColor);
  setTimeout(() => {
    if (lyricWindow) {
      lyricWindow.classList.remove('color-transitioning');
    }
  }, 300);
}

function validateAndFixColorSettings(
  currentHighlightColor: Ref<string>,
  lyricSetting: Ref<LyricSettings>
) {
  try {
    if (currentHighlightColor.value && !validateColor(currentHighlightColor.value)) {
      console.warn('Current highlight color is invalid, resetting to default');
      const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
      currentHighlightColor.value = defaultColor;
      lyricSetting.value.highlightColor = undefined;
      updateCSSVariable('--lyric-highlight-color', defaultColor);
    }
    if (lyricSetting.value.highlightColor && !validateColor(lyricSetting.value.highlightColor)) {
      console.warn('Stored highlight color is invalid, removing it');
      lyricSetting.value.highlightColor = undefined;
    }
  } catch (error) {
    console.error('Failed to validate color settings:', error);
    const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
    currentHighlightColor.value = defaultColor;
    lyricSetting.value.highlightColor = undefined;
    updateCSSVariable('--lyric-highlight-color', defaultColor);
  }
}

function initializeThemeColor(
  currentHighlightColor: Ref<string>,
  lyricSetting: Ref<LyricSettings>
) {
  let savedColor = lyricSetting.value.highlightColor;
  if (!savedColor) {
    savedColor = loadLyricThemeColor();
    if (savedColor) {
      lyricSetting.value.highlightColor = savedColor;
    }
  }
  const optimizedColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
  currentHighlightColor.value = optimizedColor;
  updateCSSVariable('--lyric-highlight-color', optimizedColor);
}

export function useLyricTheme(lyricSetting: Ref<LyricSettings>) {
  const showThemeColorPanel = ref(false);
  const currentHighlightColor = ref('#1db954');

  const toggleThemeColorPanel = () => {
    showThemeColorPanel.value = !showThemeColorPanel.value;
  };

  const handleColorChange = (color: string) => {
    if (!validateColor(color)) {
      console.error('Invalid color received:', color);
      return;
    }
    try {
      currentHighlightColor.value = color;
      updateThemeColorWithTransition(color);
      lyricSetting.value.highlightColor = color;
      saveLyricThemeColor(color);
    } catch (error) {
      console.error('Failed to handle color change:', error);
      const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
      currentHighlightColor.value = defaultColor;
      updateThemeColorWithTransition(defaultColor);
    }
  };

  const handleThemeColorPanelClose = () => {
    showThemeColorPanel.value = false;
  };

  const resetThemeColor = () => {
    const defaultColor = getCurrentLyricThemeColor(lyricSetting.value.theme);
    currentHighlightColor.value = defaultColor;
    lyricSetting.value.highlightColor = undefined;
    updateThemeColorWithTransition(defaultColor);
  };

  return {
    currentHighlightColor,
    showThemeColorPanel,
    toggleThemeColorPanel,
    handleColorChange,
    handleThemeColorPanelClose,
    initializeThemeColor: () => initializeThemeColor(currentHighlightColor, lyricSetting),
    validateAndFixColorSettings: () => validateAndFixColorSettings(currentHighlightColor, lyricSetting),
    resetThemeColor,
    updateThemeColorWithTransition,
    updateCSSVariable
  };
}
