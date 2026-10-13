<template>
  <div class="lyric-display">
    <!-- 滚动模式 -->
    <div v-if="displayMode === 'scroll'" class="lyric-scroll">
      <div class="lyric-wrapper" :style="wrapperStyle">
        <template v-if="lrcArray && lrcArray.length > 0">
          <div
            v-for="(line, index) in lrcArray"
            :key="index"
            class="lyric-line"
            :style="getDynamicLineStyle(line, showTranslation)"
            :class="{
              'lyric-line-current': index === currentIndex,
              'lyric-line-passed': index < currentIndex
            }"
          >
            <div class="lyric-text" :style="{ fontSize: `${scrollFontSize}px` }">
              <div
                v-if="line.hasWordByWord && line.words && line.words.length > 0"
                class="word-by-word"
              >
                <template v-for="(word, wi) in line.words" :key="wi">
                  <span class="lyric-word" :style="getWordStyle(index, wi, word)">{{
                    word.text
                  }}</span
                  ><span v-if="word.space" class="lyric-word">&nbsp;</span>
                </template>
              </div>
              <span v-else class="lyric-text-inner" :style="getLyricStyle(index)">{{
                line.text || ''
              }}</span>
            </div>
            <div
              v-if="showTranslation && line.trText"
              class="lyric-translation"
              :style="{ fontSize: `${fontSize * 0.6}px` }"
            >
              {{ line.trText }}
            </div>
          </div>
        </template>
        <div v-else class="lyric-empty">无歌词</div>
      </div>
    </div>

    <!-- 单行模式 -->
    <div v-else-if="displayMode === 'single'" class="lyric-single-mode">
      <template v-if="lrcArray && lrcArray.length > 0 && lrcArray[currentIndex]">
        <div class="lyric-line lyric-line-current">
          <div class="lyric-text" :style="{ fontSize: `${fontSize}px` }">
            <div
              v-if="
                lrcArray[currentIndex]!.hasWordByWord &&
                lrcArray[currentIndex]!.words &&
                lrcArray[currentIndex]!.words!.length > 0
              "
              class="word-by-word"
            >
              <template v-for="(word, wi) in lrcArray[currentIndex]!.words" :key="wi">
                <span class="lyric-word" :style="getWordStyle(currentIndex, wi, word)">{{
                  word.text
                }}</span
                ><span v-if="word.space" class="lyric-word">&nbsp;</span>
              </template>
            </div>
            <span v-else class="lyric-text-inner" :style="getLyricStyle(currentIndex)">
              {{ lrcArray[currentIndex]!.text || '' }}
            </span>
          </div>
          <div
            v-if="showTranslation && lrcArray[currentIndex]!.trText"
            class="lyric-translation"
            :style="{ fontSize: `${fontSize * 0.6}px` }"
          >
            {{ lrcArray[currentIndex]!.trText }}
          </div>
        </div>
      </template>
      <div v-else class="lyric-empty">无歌词</div>
    </div>

    <!-- 双行模式（滑动窗口） -->
    <div v-else class="lyric-double-mode">
      <template v-if="lrcArray && lrcArray.length > 0 && currentGroupLines.length > 0">
        <div
          v-for="line in currentGroupLines"
          :key="line.index"
          class="lyric-line"
          :class="{ 'lyric-line-current': line.index === currentIndex }"
        >
          <div class="lyric-text" :style="{ fontSize: `${fontSize}px` }">
            <div
              v-if="line.hasWordByWord && line.words && line.words.length > 0"
              class="word-by-word"
            >
              <template v-for="(word, wi) in line.words" :key="wi">
                <span class="lyric-word" :style="getWordStyle(line.index, wi, word)">{{
                  word.text
                }}</span
                ><span v-if="word.space" class="lyric-word">&nbsp;</span>
              </template>
            </div>
            <span v-else class="lyric-text-inner" :style="getLyricStyle(line.index)">{{
              line.text || ''
            }}</span>
          </div>
          <div
            v-if="showTranslation && line.trText"
            class="lyric-translation"
            :style="{ fontSize: `${fontSize * 0.6}px` }"
          >
            {{ line.trText }}
          </div>
        </div>
      </template>
      <div v-else class="lyric-empty">无歌词</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LyricLine } from '../composables/useLyricState';

interface Word {
  text: string;
  startTime: number;
  duration: number;
  space?: boolean;
}

interface GroupLine extends LyricLine {
  index: number;
}

interface Props {
  lrcArray?: LyricLine[];
  currentIndex: number;
  fontSize?: number;
  scrollFontSize?: number;
  displayMode: 'scroll' | 'single' | 'double';
  showTranslation: boolean;
  wrapperStyle?: Record<string, any>;
  currentGroupLines?: GroupLine[];
  getWordStyle?: (lineIndex: number, wordIndex: number, word: Word) => Record<string, any>;
  getLyricStyle?: (lineIndex: number) => Record<string, any>;
  getDynamicLineStyle?: (line: LyricLine, showTranslation: boolean) => Record<string, any>;
}

withDefaults(defineProps<Props>(), {
  lrcArray: () => [],
  fontSize: 24,
  scrollFontSize: 24,
  wrapperStyle: () => ({}),
  currentGroupLines: () => [],
  getWordStyle: () => ({}),
  getLyricStyle: () => ({}),
  getDynamicLineStyle: () => ({})
});
</script>

<style lang="scss" scoped>
.lyric-display {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// ── 滚动模式 ──
.lyric-scroll {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
}

.lyric-wrapper {
  will-change: transform;
  padding: 10vh 0;
  transform-origin: center center;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.lyric-scroll {
  .lyric-line {
    transition:
      opacity 0.25s ease,
      transform 0.25s ease;

    &.lyric-line-current {
      opacity: 1;
      transform: scale(1.06);
    }

    &:not(.lyric-line-current) {
      opacity: 0.55;
    }
  }

  .lyric-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// ── 单行模式 ──
.lyric-single-mode {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;

  .lyric-line {
    width: 100%;
    text-align: center;
  }
}

// ── 双行模式 ──
.lyric-double-mode {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 20px;

  .lyric-line {
    width: 100%;
    text-align: center;
    opacity: 0.6;
    transition:
      opacity 0.25s ease,
      transform 0.25s ease;

    &.lyric-line-current {
      opacity: 1;
      transform: scale(1.03);
    }
  }
}

// ── 通用 ──
.lyric-line {
  line-height: 1;
}

.lyric-text {
  color: #fff;
  line-height: 1.2;
  text-align: center;
  text-shadow: var(--lyric-text-shadow, none);
}

.light .lyric-text {
  color: #1a1a1a;
}

.lyric-word {
  display: inline-block;
  transition: color 0.15s ease;
}

.lyric-text-inner {
  display: inline;
}

.lyric-translation {
  margin-top: 4px;
  opacity: 0.6;
  line-height: 1.3;
}

.lyric-empty {
  color: rgba(255, 255, 255, 0.3);
  font-size: 14px;
}

.light .lyric-empty {
  color: rgba(0, 0, 0, 0.3);
}
</style>
