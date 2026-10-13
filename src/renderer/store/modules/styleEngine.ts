/**
 * 样式引擎 Store (StyleEngine)
 *
 * 聚合播放状态、音频特征、副歌数据、封面颜色、社区数据
 * 供所有视觉模式（Default/Stage/Magazine/Frenzy）消费
 */

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

import type { KeywordLine } from '@/api/keywords';
import { nowTime } from '@/hooks/MusicHook';
import { useCoverColor } from '@/hooks/useCoverColor';
import { climaxDetector } from '@/services/climaxDetector';
import { type BeatInfo,drumDetector } from '@/services/drumDetector';

import { useClimaxStore } from './climax';
import { useCommunityDataStore } from './communityData';
import { usePlayerStore } from './player';

export const useStyleEngineStore = defineStore('styleEngine', () => {
  // ==================== 播放状态 ====================
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const currentSong = ref<any>(null);

  // ==================== 音频特征 ====================
  const energyLevel = ref(0);
  const spectrumCoverage = ref(0);
  const bpm = ref(0);
  const beatFlux = ref(0);
  const kickEnergy = ref(0);
  const isBeat = ref(false);
  const isStrongBeat = ref(false);

  // ==================== 副歌状态 ====================
  const isInClimax = ref(false);
  const climaxSegments = ref<{ start: number; end: number }[]>([]);

  // ==================== 社区数据（重点词） ====================
  const keywordLines = ref<KeywordLine[]>([]);
  const currentLineKeywords = ref<{ wordIndex: number; text: string; emphasis: string }[]>([]);
  const currentLineIndex = ref<number>(-1);

  // ==================== 封面颜色 ====================
  const primaryColor = ref('#888888');
  const accentColor = ref('#e879f9');
  const averageColor = ref('#444444');

  // ==================== 音频特征更新 ====================
  let beatUnsubscribe: (() => void) | null = null;
  let climaxUnsubscribe: (() => void) | null = null;

  function startAudioAnalysis() {
    // 启动鼓点检测
    drumDetector.start();
    beatUnsubscribe = drumDetector.onBeat((info: BeatInfo) => {
      bpm.value = info.bpm;
      beatFlux.value = info.flux;
      kickEnergy.value = info.kickEnergy;
      isBeat.value = true;
      isStrongBeat.value = info.isStrong;

      // 重置 isBeat（单帧信号）
      setTimeout(() => {
        isBeat.value = false;
        isStrongBeat.value = false;
      }, 50);
    });

    // 启动高潮检测
    climaxDetector.start();
    climaxUnsubscribe = climaxDetector.onClimax((energy) => {
      // 高潮检测器的回调
    });
  }

  function stopAudioAnalysis() {
    if (beatUnsubscribe) {
      beatUnsubscribe();
      beatUnsubscribe = null;
    }
    if (climaxUnsubscribe) {
      climaxUnsubscribe();
      climaxUnsubscribe = null;
    }
    drumDetector.stop();
    climaxDetector.stop();
  }

  // ==================== 副歌数据同步 ====================

  // 响应式同步：communityData 的高潮段落变化时自动更新 styleEngine
  watch(
    () => useCommunityDataStore().climaxSegments,
    (newSegments) => {
      climaxSegments.value = newSegments;
    },
    { immediate: true }
  );

  async function loadClimaxData(songId: string) {
    const communityData = useCommunityDataStore();
    await communityData.loadAll(songId);

    // 同步到 styleEngine（watch 也会触发，但这里确保首次赋值）
    climaxSegments.value = communityData.climaxSegments;
    keywordLines.value = communityData.keywordMark?.lines ?? [];
  }

  // ==================== 时间同步 ====================
  watch(nowTime, (time) => {
    currentTime.value = time;

    // 实时更新音频特征
    energyLevel.value = climaxDetector.energyLevel;
    spectrumCoverage.value = climaxDetector.spectrumCoverage;

    // 使用后端高潮时段数据判断是否在高潮段
    const segments = climaxSegments.value;
    let inClimax = false;
    for (const seg of segments) {
      if (time >= seg.start && time <= seg.end) {
        inClimax = true;
        break;
      }
    }
    isInClimax.value = inClimax;

    // 更新当前行的重点词（由外部传入歌词行索引）
    // 注意：这里需要外部组件在切换行时调用 updateCurrentLineKeywords
  });

  // ==================== 播放状态同步 ====================
  function syncFromPlayerStore() {
    const playerStore = usePlayerStore();
    isPlaying.value = playerStore.isPlaying;
    duration.value = playerStore.currentSong?.dt ? playerStore.currentSong.dt / 1000 : 0;
    currentSong.value = playerStore.currentSong;
  }

  // ==================== 封面颜色同步 ====================
  function syncCoverColors() {
    const coverColor = useCoverColor();
    primaryColor.value = coverColor.primaryColor.value;
    accentColor.value = coverColor.primaryColor.value;
    averageColor.value = coverColor.averageColor.value;
  }

  // ==================== 重点词更新 ====================
  function updateCurrentLineKeywords(lineIndex: number) {
    if (lineIndex === currentLineIndex.value) return;
    currentLineIndex.value = lineIndex;

    const line = keywordLines.value.find(l => l.lineIndex === lineIndex);
    currentLineKeywords.value = line?.words ?? [];
  }

  function getWordEmphasis(wordIndex: number): 'strong' | 'medium' | 'light' | null {
    const word = currentLineKeywords.value.find(w => w.wordIndex === wordIndex);
    return (word?.emphasis as 'strong') ?? null;
  }

  // ==================== 初始化 ====================
  function init() {
    startAudioAnalysis();
    syncFromPlayerStore();
    syncCoverColors();
  }

  function dispose() {
    stopAudioAnalysis();
  }

  return {
    // 播放状态
    isPlaying,
    currentTime,
    duration,
    currentSong,
    // 音频特征
    energyLevel,
    spectrumCoverage,
    bpm,
    beatFlux,
    kickEnergy,
    isBeat,
    isStrongBeat,
    // 副歌状态
    isInClimax,
    climaxSegments,
    // 社区数据（重点词）
    keywordLines,
    currentLineKeywords,
    currentLineIndex,
    // 封面颜色
    primaryColor,
    accentColor,
    averageColor,
    // 方法
    init,
    dispose,
    startAudioAnalysis,
    stopAudioAnalysis,
    loadClimaxData,
    syncFromPlayerStore,
    syncCoverColors,
    updateCurrentLineKeywords,
    getWordEmphasis,
  };
});
