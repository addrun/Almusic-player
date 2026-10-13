<template>
  <div class="frenzy-lyrics">
    <div class="frenzy-lyrics__content">
      <div
        v-if="currentLyric"
        :key="currentIndex"
        class="frenzy-lyrics__block"
        ref="blockRef"
        :style="blockStyle"
      >
        <!-- 黑字层（底层） -->
        <div class="frenzy-lyrics__black-text" ref="blackTextRef" :style="blackTextStyle">
          {{ detectionResult.blackText }}
        </div>

        <!-- 红字层（顶层） -->
        <div class="frenzy-lyrics__red-words" ref="redWordsContainerRef">
          <span
            v-for="(word, index) in detectionResult.redWords"
            :key="index"
            class="frenzy-lyrics__red-word"
            :ref="
              (el: any) => {
                if (el) redWordRefs[index] = el;
              }
            "
            :style="redTextStyle"
          >
            {{ word }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * FrenzyLyrics - 狂躁模式歌词组件（初稿设计）
 *
 * 黑字层（可拉伸 scaleY）+ 红字层（正常比例）
 * 无 GSAP 动效
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { usePlayerStore } from '@/store/modules/player';
import { useStyleEngineStore } from '@/store/modules/styleEngine';
import type { LyricConfig } from '@/types/lyric';
import {
  analyzeLyricsForHighFreqWords,
  detectEmotionalWords,
  type EmotionalDetectionResult
} from '@/utils/emotionalDetector';

interface LyricLine {
  text: string;
  startTime: number;
  duration: number;
}

interface Props {
  lyrics: LyricLine[];
  currentTime: number;
}

const props = defineProps<Props>();

const playerStore = usePlayerStore();
const styleEngine = useStyleEngineStore();

const frenzyConfig = ref<
  Pick<
    LyricConfig,
    | 'frenzyVerticalStretch'
    | 'frenzyScale'
    | 'frenzyFontWeight'
    | 'frenzyCustomFont'
    | 'frenzyShowEmphasisWords'
    | 'frenzyShowRedKeywords'
    | 'frenzyUseCoverColor'
    | 'frenzyKeywordCustomColor'
  >
>({
  frenzyVerticalStretch: 1.3,
  frenzyScale: 1.0,
  frenzyFontWeight: 900,
  frenzyCustomFont: 'PingFang SC',
  frenzyShowEmphasisWords: true,
  frenzyShowRedKeywords: true,
  frenzyUseCoverColor: true,
  frenzyKeywordCustomColor: '#ff0000'
});

const showRedKeywords = computed(() => frenzyConfig.value.frenzyShowRedKeywords !== false);

// 强调字颜色（级联：始终红色 → 跟随封面取色 → 自定义）
const keywordColor = computed(() => {
  if (frenzyConfig.value.frenzyShowRedKeywords !== false) return '#cc0000';
  if (frenzyConfig.value.frenzyUseCoverColor !== false) return styleEngine.primaryColor;
  return frenzyConfig.value.frenzyKeywordCustomColor;
});

// 整体缩放（仅缩放，不拉伸）
const blockStyle = computed(() => ({
  transform: `scale(${frenzyConfig.value.frenzyScale ?? 1})`
}));

// 黑字样式：应用 scaleY 拉伸 + 字体和粗细
const blackTextStyle = computed(() => ({
  fontFamily: `'${frenzyConfig.value.frenzyCustomFont}', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
  fontWeight: frenzyConfig.value.frenzyFontWeight ?? 900,
  transform: `scaleY(${frenzyConfig.value.frenzyVerticalStretch})`
}));

// 红字样式：加粗字体，正常比例（无 scaleY），应用字体和强调色
const redTextStyle = computed(() => ({
  fontFamily: `'${frenzyConfig.value.frenzyCustomFont}', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
  fontWeight: 900,
  color: keywordColor.value
}));

const blockRef = ref<HTMLElement | null>(null);
const blackTextRef = ref<HTMLElement | null>(null);
const redWordsContainerRef = ref<HTMLElement | null>(null);
const redWordRefs = ref<HTMLElement[]>([]);

const currentLyric = ref<LyricLine | null>(null);
const currentIndex = ref(-1);

// 情感词检测结果（优先使用服务器重点词，降级到本地检测）
const detectionResult = computed<EmotionalDetectionResult>(() => {
  if (!currentLyric.value) {
    return { fullText: '', blackText: '', redWords: [] };
  }

  const text = currentLyric.value.text;

  // 强词总开关关闭时，不显示强调词
  if (frenzyConfig.value.frenzyShowEmphasisWords === false) {
    return { fullText: text, blackText: text, redWords: [] };
  }

  // 优先使用服务器重点词
  const serverKeywords = styleEngine.currentLineKeywords;
  if (serverKeywords.length > 0 && currentLineIndex.value >= 0) {
    // 计算当前行的字符偏移量（wordIndex 是全局索引）
    let offset = 0;
    for (let i = 0; i < currentLineIndex.value; i++) {
      offset += (props.lyrics[i]?.text || '').length;
    }

    // 将全局 wordIndex 转换为局部索引
    const localIndices = new Set(serverKeywords.map((k) => k.wordIndex - offset));
    const redWords: string[] = [];
    const blackChars: string[] = [];

    for (let i = 0; i < text.length; i++) {
      if (localIndices.has(i)) {
        redWords.push(text[i]);
      } else {
        blackChars.push(text[i]);
      }
    }

    return {
      fullText: text,
      blackText: blackChars.join(''),
      redWords
    };
  }

  // 降级到本地情感词检测
  const customDict = playerStore.currentSong?.lyric?.frenzyEmotionalDict;
  return detectEmotionalWords(text, customDict);
});

// 计算当前播放的歌词行（startTime 为毫秒，currentTime 为秒）
const currentLineIndex = computed(() => {
  if (!props.lyrics || props.lyrics.length === 0) return -1;

  const timeMs = props.currentTime * 1000;
  for (let i = props.lyrics.length - 1; i >= 0; i--) {
    if (props.lyrics[i].startTime !== undefined && timeMs >= props.lyrics[i].startTime!) {
      return i;
    }
  }
  return -1;
});

// 监听歌词加载，分析高频词
watch(
  () => props.lyrics,
  (newLyrics) => {
    if (newLyrics && newLyrics.length > 0) {
      analyzeLyricsForHighFreqWords(newLyrics);
    }
  },
  { immediate: true }
);

// 监听歌词行变化
watch(currentLineIndex, async (newIndex, oldIndex) => {
  if (newIndex === oldIndex) return;
  if (newIndex < 0) {
    currentLyric.value = null;
    currentIndex.value = -1;
    styleEngine.updateCurrentLineKeywords(-1);
    return;
  }

  currentIndex.value = newIndex;
  currentLyric.value = props.lyrics[newIndex];
  redWordRefs.value = [];

  // 更新样式引擎的当前行重点词
  styleEngine.updateCurrentLineKeywords(newIndex);
});

onMounted(() => {
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    const parsed = JSON.parse(saved);
    frenzyConfig.value = {
      frenzyVerticalStretch: parsed.frenzyVerticalStretch ?? 1.3,
      frenzyScale: parsed.frenzyScale ?? 1.0,
      frenzyFontWeight: parsed.frenzyFontWeight ?? 900,
      frenzyCustomFont: parsed.frenzyCustomFont || 'PingFang SC',
      frenzyShowEmphasisWords: parsed.frenzyShowEmphasisWords !== false,
      frenzyShowRedKeywords: parsed.frenzyShowRedKeywords !== false,
      frenzyUseCoverColor: parsed.frenzyUseCoverColor !== false,
      frenzyKeywordCustomColor: parsed.frenzyKeywordCustomColor || '#ff0000'
    };
  }
  window.addEventListener('music-full-config-updated', handleConfigUpdate);
});

const handleConfigUpdate = () => {
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    const parsed = JSON.parse(saved);
    frenzyConfig.value = {
      frenzyVerticalStretch: parsed.frenzyVerticalStretch ?? 1.3,
      frenzyScale: parsed.frenzyScale ?? 1.0,
      frenzyFontWeight: parsed.frenzyFontWeight ?? 900,
      frenzyCustomFont: parsed.frenzyCustomFont || 'PingFang SC',
      frenzyShowEmphasisWords: parsed.frenzyShowEmphasisWords !== false,
      frenzyShowRedKeywords: parsed.frenzyShowRedKeywords !== false,
      frenzyUseCoverColor: parsed.frenzyUseCoverColor !== false,
      frenzyKeywordCustomColor: parsed.frenzyKeywordCustomColor || '#ff0000'
    };
  }
};

onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
});
</script>

<style scoped>
.frenzy-lyrics {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.frenzy-lyrics__content {
  position: relative;
  width: 90%;
  max-width: 1000px;
  text-align: center;
}

.frenzy-lyrics__block {
  position: relative;
  padding: 2rem;
  transform-origin: center;
  will-change: transform;
}

.frenzy-lyrics__black-text {
  font-size: clamp(2rem, 5vw, 4rem);
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.2;
  letter-spacing: -0.05em;
}

.frenzy-lyrics__red-words {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.frenzy-lyrics__red-word {
  font-size: clamp(2.5rem, 6vw, 5rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.03em;
  opacity: 1;
}
</style>
