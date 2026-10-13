<template>
  <div class="music-full-bg" :style="bgStyle">
    <!-- 背景图片层 -->
    <div
      v-if="config.useCustomBackground && config.backgroundMode === 'image' && config.backgroundImage"
      class="mf-bg-image-layer"
      :style="backgroundImageStyle"
    ></div>

    <div class="mf-bg-content" :class="[config.theme]">
      <!-- 通用控件（右上全屏，隐藏关闭/设置按钮） -->
      <player-controls
        :isFullScreen="isFullScreen"
        @toggleFullscreen="toggleFullScreen"
        :showStyleSwitch="false"
        :hideClose="true"
        :hideSettings="true"
        :autoHide="true"
      />

      <div class="mf-content-wrapper" :style="{ width: `${config.contentWidth}%` }">
        <!-- 左侧：封面区域 -->
        <div
          v-if="!config.hideCover"
          class="mf-left-side"
          :class="{ 'only-cover': config.hideLyrics }"
        >
          <div class="mf-img-container">
            <cover3-d
              ref="PicImgRef"
              :src="getImgUrl(playMusic?.picUrl, '500y500')"
              :loading="playMusic?.playLoading"
              :max-tilt="12"
              :scale="1.03"
              :shine-intensity="0.25"
            />
          </div>
          <div class="mf-music-info">
            <div class="mf-music-name" v-html="playMusic.name"></div>
            <div class="mf-music-singer">
              <n-ellipsis
                class="text-ellipsis"
                line-clamp="2"
                :tooltip="{ contentStyle: { maxWidth: '600px' }, zIndex: 99999 }"
              >
                <span
                  v-for="(item, index) in artistList"
                  :key="index"
                  class="cursor-pointer hover:text-[var(--accent-color)]"
                  @click="handleArtistClick(item.id)"
                >
                  {{ item.name }}
                  {{ index < artistList.length - 1 ? ' / ' : '' }}
                </span>
              </n-ellipsis>
            </div>
            <simple-play-bar
              v-if="!config.hideMiniPlayBar"
              class="mt-4"
              :pure-mode-enabled="config.pureModeEnabled"
              :isDark="textColors.theme === 'dark'"
            />
          </div>
        </div>

        <!-- 右侧：歌词区域 -->
        <div
          class="mf-right-side"
          :class="{
            center: config.centerLyrics,
            hide: config.hideLyrics,
            'full-width': config.hideCover
          }"
        >
          <n-layout
            ref="lrcSider"
            class="mf-music-lrc"
            :native-scrollbar="false"
            @mouseover="mouseOverLayout"
            @mouseleave="mouseLeaveLayout"
          >
            <div class="mf-lrc-container">
              <div
                v-if="config.hideCover"
                class="mf-info-header"
                :style="{ textAlign: config.centerLyrics ? 'center' : 'left' }"
              >
                <div class="mf-info-name" v-html="playMusic.name"></div>
                <div class="mf-info-singer">
                  <span
                    v-for="(item, index) in artistList"
                    :key="index"
                    class="cursor-pointer hover:text-[var(--accent-color)]"
                    @click="handleArtistClick(item.id)"
                  >
                    {{ item.name }}
                    {{ index < artistList.length - 1 ? ' / ' : '' }}
                  </span>
                </div>
              </div>
              <div v-if="!hasLyrics" class="mf-lrc-text no-scroll-tip">
                <span>暂无歌词</span>
              </div>
              <div v-else-if="!supportAutoScroll" class="mf-lrc-text no-scroll-tip">
                <span>{{ t('player.lrc.noAutoScroll') }}</span>
              </div>
              <div
                v-for="(item, index) in lrcArray"
                :id="`mf-bg-lrc-${index}`"
                :key="index"
                class="mf-lrc-text"
                :class="{
                  'now-text': index === nowIndex,
                  'hover-text': item.text && item.startTime !== -1
                }"
                @click="item.startTime !== -1 ? setAudioTime(index) : null"
              >
                <div v-if="item.hasWordByWord && item.words && item.words.length > 0" class="word-by-word-lyric">
                  <template v-for="(word, wordIndex) in item.words" :key="wordIndex">
                    <span class="lyric-word" :style="getWordStyle(index, wordIndex, word)">{{ word.text }} </span>
                    <span class="lyric-word" v-if="word.space">&nbsp;</span>
                  </template>
                </div>
                <span v-else :style="getLrcStyle(index)">{{ item.text }}</span>
                <div v-show="config.showTranslation" class="mf-lrc-tr">{{ item.trText }}</div>
              </div>
              <div v-if="!lrcArray.length" class="mf-lrc-text">
                <span>{{ t('player.lrc.noLrc') }}</span>
              </div>
            </div>
            <lyric-correction-control
              v-if="!isMobile"
              :correction-time="correctionTime"
              @adjust="adjustCorrectionTime"
            />
          </n-layout>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import Cover3D from '@/components/cover/Cover3D.vue';
import LyricCorrectionControl from '@/components/lyric/LyricCorrectionControl.vue';
import LyricSettings from '@/components/lyric/LyricSettings.vue';
import PlayerControls from '@/components/lyric/PlayerControls.vue';
import SimplePlayBar from '@/components/player/SimplePlayBar.vue';
import {
  adjustCorrectionTime,
  artistList,
  correctionTime,
  lrcArray,
  nowIndex,
  nowTime,
  playMusic,
  setAudioTime,
  textColors,
  useLyricProgress
} from '@/hooks/MusicHook';
import { useArtist } from '@/hooks/useArtist';
import { usePlayerStore } from '@/store/modules/player';
import { useSettingsStore } from '@/store/modules/settings';
import { DEFAULT_LYRIC_CONFIG, LyricConfig } from '@/types/lyric';
import { getImgUrl, isMobile } from '@/utils';
import { animateGradient, getHoverBackgroundColor, getTextColors } from '@/utils/linearColor';

const { t } = useI18n();

const props = defineProps({
  background: {
    type: String,
    default: '#000'
  }
});

const lrcSider = ref<any>(null);
const isMouse = ref(false);
const currentBackground = ref('#000');
const animationFrame = ref<number | null>(null);
const isDark = ref(false);
const isFullScreen = ref(false);
const showStickyHeader = ref(false);
const lyricSettingsRef = ref<InstanceType<typeof LyricSettings>>();

const config = ref<LyricConfig>({ ...DEFAULT_LYRIC_CONFIG });

watch(
  () => lyricSettingsRef.value?.config,
  (newConfig) => {
    if (newConfig) config.value = newConfig;
  },
  { deep: true, immediate: true }
);

watch(
  () => config.value,
  (newConfig) => {
    localStorage.setItem('music-full-config', JSON.stringify(newConfig));
  },
  { deep: true }
);

// 加载保存的配置
onMounted(() => {
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    try {
      config.value = { ...config.value, ...JSON.parse(saved) };
    } catch {}
  }
});

const hasLyrics = computed(() => lrcArray.value && lrcArray.value.length > 0);
const supportAutoScroll = computed(() => {
  if (!hasLyrics.value) return false;
  return lrcArray.value.some((line) => line.startTime !== undefined && line.startTime > 0);
});

// 自定义背景
const customBackgroundStyle = computed(() => {
  if (!config.value.useCustomBackground) return null;
  switch (config.value.backgroundMode) {
    case 'solid': return config.value.solidColor;
    case 'gradient': {
      const { colors, direction } = config.value.gradientColors;
      return `linear-gradient(${direction}, ${colors.join(', ')})`;
    }
    case 'image':
      return config.value.backgroundImage || null;
    case 'css':
      return config.value.customCss || null;
    default: return null;
  }
});

const themeMusic = {
  light: 'linear-gradient(to bottom, #ffffff, #f5f5f5)',
  dark: 'linear-gradient(to bottom, #1a1a1a, #000000)'
};

const targetBackground = computed(() => {
  if (config.value.useCustomBackground && customBackgroundStyle.value) {
    if (typeof customBackgroundStyle.value === 'string') return customBackgroundStyle.value;
  }
  if (config.value.theme !== 'default') {
    return themeMusic[config.value.theme] || props.background;
  }
  return props.background || currentBackground.value || '';
});

const bgStyle = computed(() => {
  if (config.value.useCustomBackground && config.value.backgroundMode === 'image') {
    return { background: 'transparent' };
  }
  if (config.value.useCustomBackground && customBackgroundStyle.value) {
    return { background: customBackgroundStyle.value };
  }
  return { background: targetBackground.value || props.background };
});

const backgroundImageStyle = computed(() => {
  const blur = config.value.imageBlur || 0;
  const brightness = config.value.imageBrightness || 100;
  return {
    backgroundImage: `url(${config.value.backgroundImage})`,
    filter: `blur(${blur}px) brightness(${brightness}%)`
  };
});

const setTextColors = (background: string) => {
  if (!background) {
    textColors.value = getTextColors();
    document.documentElement.style.setProperty('--hover-bg-color', getHoverBackgroundColor(false));
    document.documentElement.style.setProperty('--text-color-primary', textColors.value.primary);
    document.documentElement.style.setProperty('--text-color-active', textColors.value.active);
    return;
  }
  textColors.value = getTextColors(background);
  isDark.value = textColors.value.active === '#000000';
  document.documentElement.style.setProperty('--hover-bg-color', getHoverBackgroundColor(isDark.value));
  document.documentElement.style.setProperty('--text-color-primary', textColors.value.primary);
  document.documentElement.style.setProperty('--text-color-active', textColors.value.active);

  if (currentBackground.value) {
    if (animationFrame.value) cancelAnimationFrame(animationFrame.value);
    const result = animateGradient(currentBackground.value, background, (gradient) => {
      currentBackground.value = gradient;
    });
    if (typeof result === 'number') animationFrame.value = result;
  } else {
    currentBackground.value = background;
  }
};

watch(targetBackground, (newBg) => {
  if (newBg) setTextColors(newBg);
}, { immediate: true });

// 歌词滚动
const lrcScroll = (behavior: ScrollBehavior = 'smooth', forceTop: boolean = false) => {
  if (!lrcSider.value || !supportAutoScroll.value) return;
  if (forceTop) {
    lrcSider.value.scrollTo({ top: 0, behavior });
    return;
  }
  if (isMouse.value) return;
  const nowEl = document.querySelector(`#mf-bg-lrc-${nowIndex.value}`) as HTMLElement;
  if (nowEl) {
    const containerHeight = lrcSider.value.$el.clientHeight;
    const elementTop = nowEl.offsetTop;
    const scrollTop = elementTop - containerHeight / 2 + nowEl.clientHeight / 2;
    lrcSider.value.scrollTo({ top: scrollTop, behavior });
  }
};

const debouncedLrcScroll = useDebounceFn(lrcScroll, 200);

const mouseOverLayout = () => {
  if (isMobile.value) return;
  isMouse.value = true;
};

const mouseLeaveLayout = () => {
  if (isMobile.value) return;
  setTimeout(() => {
    isMouse.value = false;
    lrcScroll();
  }, 2000);
};

const isSongChanging = ref(false);

watch(nowIndex, () => {
  if (isSongChanging.value) return;
  debouncedLrcScroll();
});

watch(() => playMusic.value.id, (newId, oldId) => {
  if (newId !== oldId && newId) {
    isSongChanging.value = true;
    setTimeout(() => {
      lrcScroll('instant', true);
      setTimeout(() => { isSongChanging.value = false; }, 300);
    }, 100);
  }
});

const { getLrcStyle: originalLrcStyle } = useLyricProgress();

const getLrcStyle = (index: number) => {
  const colors = textColors.value || getTextColors();
  const originalStyle = originalLrcStyle(index);
  if (index === nowIndex.value) {
    if (originalStyle.backgroundImage) {
      return {
        ...originalStyle,
        backgroundImage: originalStyle.backgroundImage
          .replace(/#ffffff/g, colors.active)
          .replace(/#ffffff8a/g, `${colors.primary}`),
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent'
      };
    }
    return { color: colors.primary };
  }
  return { color: colors.primary };
};

const getWordStyle = (lineIndex: number, _wordIndex: number, word: any) => {
  const colors = textColors.value || getTextColors();
  if (lineIndex !== nowIndex.value) {
    return {
      color: colors.primary,
      transition: 'color 0.3s ease',
      backgroundImage: 'none',
      WebkitTextFillColor: 'initial'
    };
  }
  const currentTime = (nowTime.value + correctionTime.value) * 1000;
  const wordStartTime = word.startTime;
  const wordEndTime = word.startTime + word.duration;
  if (currentTime >= wordStartTime && currentTime < wordEndTime) {
    const progress = Math.min((currentTime - wordStartTime) / word.duration, 1);
    const progressPercent = Math.round(progress * 100);
    return {
      backgroundImage: `linear-gradient(to right, ${colors.active} 0%, ${colors.active} ${progressPercent}%, ${colors.primary} ${progressPercent}%, ${colors.primary} 100%)`,
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      textShadow: `0 0 8px ${colors.active}40`,
      transition: 'all 0.1s ease'
    };
  } else if (currentTime >= wordEndTime) {
    return { color: colors.active, WebkitTextFillColor: 'initial', transition: 'none' };
  } else {
    return { color: colors.primary, WebkitTextFillColor: 'initial', transition: 'none' };
  }
};

// 全屏切换
const toggleFullScreen = async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      isFullScreen.value = true;
    } else {
      await document.exitFullscreen();
      isFullScreen.value = false;
    }
  } catch (error) {
    console.error('全屏切换失败:', error);
  }
};

const handleFullScreenChange = () => {
  isFullScreen.value = !!document.fullscreenElement;
};

const settingsStore = useSettingsStore();
const playerStore = usePlayerStore();
const setData = computed(() => settingsStore.setData);
const { navigateToArtist } = useArtist();

const handleArtistClick = (id: number) => {
  navigateToArtist(id);
};

// 字体监听
watch(
  () => [setData.value.fontFamily, setData.value.fontScope],
  ([newFont, fontScope]) => {
    const defaultFonts = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    if (fontScope !== 'lyric' && fontScope !== 'global') {
      document.documentElement.style.setProperty('--current-font-family', defaultFonts);
      return;
    }
    if (newFont === 'system-ui') {
      document.documentElement.style.setProperty('--current-font-family', defaultFonts);
    } else {
      const fontList = (newFont as string).split(',').map((font) => {
        const trimmed = font.trim();
        return /[\s'"()]/.test(trimmed) && !/^['"].*['"]$/.test(trimmed) ? `"${trimmed}"` : trimmed;
      });
      document.documentElement.style.setProperty('--current-font-family', `${fontList.join(', ')}, ${defaultFonts}`);
    }
  },
  { immediate: true }
);

watch(() => config.value.fontSize, (newSize) => {
  document.documentElement.style.setProperty('--lyric-font-size', `${newSize}px`);
});
watch(() => config.value.fontWeight, (newWeight) => {
  document.documentElement.style.setProperty('--lyric-font-weight', newWeight.toString());
});
watch(() => config.value.letterSpacing, (newSpacing) => {
  document.documentElement.style.setProperty('--lyric-letter-spacing', `${newSpacing}px`);
});
watch(() => config.value.lineHeight, (newLineHeight) => {
  document.documentElement.style.setProperty('--lyric-line-height', newLineHeight.toString());
});

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullScreenChange);
  nextTick(() => lrcScroll('instant'));
});

onBeforeUnmount(() => {
  if (animationFrame.value) cancelAnimationFrame(animationFrame.value);
  document.removeEventListener('fullscreenchange', handleFullScreenChange);
  if (document.fullscreenElement) document.exitFullscreen();
});
</script>

<style lang="scss" scoped>
.music-full-bg {
  position: fixed;
  inset: 0;
  z-index: 1;
  overflow: hidden;
}

.mf-bg-image-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}

.mf-bg-content {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.mf-content-wrapper {
  display: grid;
  align-items: center;
  margin: 0 auto;
  height: 100%;
  grid-template-columns: minmax(300px, 40%) 1fr;
  gap: 4rem;
  max-width: 1600px;
  padding: 2rem;
  transition: width 0.3s ease;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    gap: 2rem;
  }
}

.mf-left-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  transition: all 0.3s ease;

  &.only-cover {
    grid-column: span 2;

    .mf-img-container {
      width: 60vh;
      aspect-ratio: 1;
    }

    .mf-music-info {
      max-width: 800px;
    }
  }

  .mf-img-container {
    position: relative;
    width: 45vh;
    margin-bottom: 2rem;
    aspect-ratio: 1;
    max-width: 100%;
  }

  .mf-music-info {
    width: 100%;
    text-align: center;
    max-width: 400px;

    .mf-music-name {
      font-size: 1.875rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      line-clamp: 2;
      color: var(--text-color-active);
    }

    .mf-music-singer {
      font-size: 1.125rem;
      opacity: 0.8;
      color: var(--text-color-primary);
    }
  }
}

.mf-right-side {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  position: relative;
  overflow: hidden;

  &.full-width {
    grid-column: span 2;
  }

  &.center {
    .mf-music-lrc {
      width: 100%;
      margin: 0 auto;
      text-align: center;
    }

    .mf-lrc-text {
      text-align: center;
      transform-origin: center center;
    }

    .word-by-word-lyric {
      justify-content: center;
    }
  }

  &.hide {
    display: none;
  }

  .mf-music-lrc {
    width: 100%;
    height: 100%;
    background: transparent;
    mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);

    .mf-info-header {
      margin-bottom: 2rem;

      .mf-info-name {
        font-size: 2.25rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
        line-clamp: 2;
        color: var(--text-color-active);
      }

      .mf-info-singer {
        font-size: 1.25rem;
        opacity: 0.8;
        color: var(--text-color-primary);
      }
    }
  }

  .mf-lrc-container {
    padding: 50vh 0;
    min-height: 100%;
  }

  .mf-lrc-text {
    font-size: 1.5rem;
    cursor: pointer;
    font-weight: 700;
    padding: 0.75rem 1rem;
    font-family: var(--current-font-family);
    font-weight: var(--lyric-font-weight, bold) !important;
    transition: all 0.3s ease;
    background-color: transparent;
    font-size: var(--lyric-font-size, 22px) !important;
    letter-spacing: var(--lyric-letter-spacing, 0) !important;
    line-height: var(--lyric-line-height, 2) !important;
    opacity: 0.6;
    transform-origin: left center;

    &.now-text {
      opacity: 1;
      transform: scale(1.05);
    }

    &.no-scroll-tip {
      font-size: 1rem;
      opacity: 0.6;
      cursor: default;
      padding: 0.5rem 0;
      color: var(--text-color-primary);
      font-weight: normal;

      &:hover {
        background-color: transparent;
      }
    }

    span {
      background-clip: text !important;
      -webkit-background-clip: text !important;
      padding-right: 30px;
    }

    .mf-lrc-tr {
      font-weight: normal;
      opacity: 0.7;
      color: var(--text-color-primary);
    }

    .word-by-word-lyric {
      display: flex;
      flex-wrap: wrap;

      .lyric-word {
        display: inline-block;
        padding-right: 0;
        font-weight: inherit;
        font-size: inherit;
        letter-spacing: inherit;
        line-height: inherit;
        cursor: inherit;
        position: relative;

        &:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
      }
    }
  }

  .hover-text {
    &:hover {
      font-weight: 700;
      opacity: 1;
      border-radius: 0.75rem;
      background-color: var(--hover-bg-color);

      span {
        color: var(--text-color-active) !important;
      }
    }
  }
}
</style>
