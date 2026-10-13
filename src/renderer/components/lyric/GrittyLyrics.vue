<template>
  <div class="gritty-lyrics">
    <div class="gritty-lyrics__content">
      <div
        v-if="currentLyric"
        :key="currentIndex"
        class="gritty-lyrics__block"
        ref="blockRef"
        :style="blockStyle"
      >
        <!-- 黑字层（底层） -->
        <div class="gritty-lyrics__black-text" ref="blackTextRef" :style="blackTextStyle">
          {{ detectionResult.blackText }}
        </div>

        <!-- 红字层（顶层） -->
        <div class="gritty-lyrics__red-words" ref="redWordsContainerRef">
          <span
            v-for="(word, index) in detectionResult.redWords"
            :key="index"
            class="gritty-lyrics__red-word"
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
 * GrittyLyrics - 粗粝模式歌词组件
 *
 * 黑字层 + 红字层叠加显示
 * 支持情感词检测
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

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

const styleEngine = useStyleEngineStore();
const playerStore = usePlayerStore();

const grittyConfig = ref<
  Pick<
    LyricConfig,
    | 'grittyVerticalStretch'
    | 'grittyScale'
    | 'grittyFontWeight'
    | 'grittyCustomFont'
    | 'grittyShowRedKeywords'
    | 'grittyKeywordColorMode'
    | 'grittyKeywordCustomColor'
  >
>({
  grittyVerticalStretch: 1.3,
  grittyScale: 1.0,
  grittyFontWeight: 900,
  grittyCustomFont: 'PingFang SC',
  grittyShowRedKeywords: true,
  grittyKeywordColorMode: 'red',
  grittyKeywordCustomColor: '#ff0000'
});

const showRedKeywords = computed(() => grittyConfig.value.grittyShowRedKeywords !== false);

// 强调字颜色
const keywordColor = computed(() => {
  const mode = grittyConfig.value.grittyKeywordColorMode;
  if (mode === 'cover') return styleEngine.primaryColor;
  if (mode === 'custom') return grittyConfig.value.grittyKeywordCustomColor;
  return '#8b0000'; // 默认红色
});

// 整体缩放（仅缩放，不拉伸）
const blockStyle = computed(() => ({
  transform: `scale(${grittyConfig.value.grittyScale ?? 1})`
}));

// 黑字样式：应用 scaleY 拉伸 + 字体和粗细
const blackTextStyle = computed(() => ({
  fontFamily: `'${grittyConfig.value.grittyCustomFont}', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
  fontWeight: grittyConfig.value.grittyFontWeight ?? 900,
  transform: `scaleY(${grittyConfig.value.grittyVerticalStretch})`
}));

// 红字样式：加粗字体，正常比例（无 scaleY），应用字体和强调色
const redTextStyle = computed(() => ({
  fontFamily: `'${grittyConfig.value.grittyCustomFont}', 'PingFang SC', 'Microsoft YaHei', sans-serif`,
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
  const customDict = playerStore.currentSong?.lyric?.grittyEmotionalDict;
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
    grittyConfig.value = {
      grittyVerticalStretch: parsed.grittyVerticalStretch ?? 1.3,
      grittyScale: parsed.grittyScale ?? 1.0,
      grittyFontWeight: parsed.grittyFontWeight ?? 900,
      grittyCustomFont: parsed.grittyCustomFont || 'PingFang SC',
      grittyShowRedKeywords: parsed.grittyShowRedKeywords !== false,
      grittyKeywordColorMode: parsed.grittyKeywordColorMode || 'red',
      grittyKeywordCustomColor: parsed.grittyKeywordCustomColor || '#ff0000'
    };
  }
  window.addEventListener('music-full-config-updated', handleConfigUpdate);
});

const handleConfigUpdate = () => {
  const saved = localStorage.getItem('music-full-config');
  if (saved) {
    const parsed = JSON.parse(saved);
    grittyConfig.value = {
      grittyVerticalStretch: parsed.grittyVerticalStretch ?? 1.3,
      grittyScale: parsed.grittyScale ?? 1.0,
      grittyFontWeight: parsed.grittyFontWeight ?? 900,
      grittyCustomFont: parsed.grittyCustomFont || 'PingFang SC',
      grittyShowRedKeywords: parsed.grittyShowRedKeywords !== false,
      grittyKeywordColorMode: parsed.grittyKeywordColorMode || 'red',
      grittyKeywordCustomColor: parsed.grittyKeywordCustomColor || '#ff0000'
    };
  }
};

onUnmounted(() => {
  window.removeEventListener('music-full-config-updated', handleConfigUpdate);
});
</script>

<style scoped>
.gritty-lyrics {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.gritty-lyrics__content {
  position: relative;
  width: 90%;
  max-width: 1000px;
  text-align: center;
}

.gritty-lyrics__block {
  position: relative;
  padding: 2rem;
  transform-origin: center;
  will-change: transform, opacity;
}

.gritty-lyrics__black-text {
  font-size: clamp(2rem, 5vw, 4rem);
  font-weight: 700;
  color: #e0e0e0;
  line-height: 1.2;
  letter-spacing: -0.05em;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

.gritty-lyrics__red-words {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.gritty-lyrics__red-word {
  font-size: clamp(2.5rem, 6vw, 5rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.03em;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  opacity: 1;
  will-change: transform, opacity;
}
</style>
