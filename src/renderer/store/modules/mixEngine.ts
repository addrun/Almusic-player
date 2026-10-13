import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// ==================== 类型定义 ====================

export type TransitionLevel = 1 | 2 | 3;

export interface HardwareScore {
  level: TransitionLevel;
  cpuCores: number;
  memoryGB: number;
  reason: string;
}

export interface BpmCacheEntry {
  bpm: number;
  confidence: number;
  beatOffset: number;
}

// ==================== 硬件评估 ====================

export function evaluateHardware(): HardwareScore {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory || 4;

  // Level 3 需要同时创建 6 个 BiquadFilterNode（A×3 + B×3）
  // + AnalyserNode + 双 source → 需要较高资源
  if (cores >= 8 && mem >= 8) {
    return {
      level: 3,
      cpuCores: cores,
      memoryGB: mem,
      reason: `${cores}核 / ${mem}GB，资源充足，推荐频域拼接`
    };
  }
  // Level 2 需要 Worker 分析 BPM + 实时节拍对齐
  if (cores >= 4 && mem >= 4) {
    return {
      level: 2,
      cpuCores: cores,
      memoryGB: mem,
      reason: `${cores}核 / ${mem}GB，适合节拍对齐`
    };
  }
  // Level 1 纯 GainNode 曲线，几乎无额外开销
  return {
    level: 1,
    cpuCores: cores,
    memoryGB: mem,
    reason: `${cores}核 / ${mem}GB，推荐等功率过渡`
  };
}

/** 检查指定等级在当前硬件下是否可用 */
export function isLevelAvailable(level: TransitionLevel): boolean {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory || 4;
  if (level === 1) return true;
  if (level === 2) return cores >= 2 && mem >= 2;
  if (level === 3) return cores >= 4 && mem >= 4;
  return false;
}

// ==================== Store ====================

export const useMixEngineStore = defineStore('mixEngine', () => {
  // ==================== State ====================
  const smartMixEnabled = ref<boolean>(
    localStorage.getItem('smartMixEnabled') === 'true'
  );
  const transitionLevel = ref<TransitionLevel>(
    parseInt(localStorage.getItem('mixTransitionLevel') || '1') as TransitionLevel
  );
  const crossfadeDuration = ref<number>(
    parseFloat(localStorage.getItem('mixCrossfadeDuration') || '8')
  );
  const bpmPreAnalysis = ref<boolean>(
    localStorage.getItem('mixBpmPreAnalysis') === 'true'
  );
  const isTransitioning = ref(false);
  const bpmCache = ref<Map<string, BpmCacheEntry>>(new Map());
  const hardwareScore = ref<HardwareScore | null>(null);

  // ==================== Computed ====================
  const recommendedLevel = computed<TransitionLevel>(
    () => hardwareScore.value?.level ?? 1
  );

  const currentBpm = computed<number | null>(() => {
    // 返回缓存的 BPM（由外部设置 currentTrackId）
    return null; // 由 useSmartAudio 在播放时设置
  });

  // ==================== Actions ====================

  const setSmartMixEnabled = (enabled: boolean) => {
    smartMixEnabled.value = enabled;
    localStorage.setItem('smartMixEnabled', String(enabled));
  };

  const setTransitionLevel = (level: TransitionLevel) => {
    if (!isLevelAvailable(level)) return;
    transitionLevel.value = level;
    localStorage.setItem('mixTransitionLevel', String(level));
  };

  const setCrossfadeDuration = (duration: number) => {
    crossfadeDuration.value = Math.max(2, Math.min(15, duration));
    localStorage.setItem('mixCrossfadeDuration', String(crossfadeDuration.value));
  };

  const setBpmPreAnalysis = (enabled: boolean) => {
    bpmPreAnalysis.value = enabled;
    localStorage.setItem('mixBpmPreAnalysis', String(enabled));
  };

  const setTransitioning = (transitioning: boolean) => {
    isTransitioning.value = transitioning;
  };

  /** 缓存 BPM 分析结果 */
  const cacheBpm = (trackId: string, entry: BpmCacheEntry) => {
    bpmCache.value.set(trackId, entry);
  };

  /** 获取缓存的 BPM */
  const getCachedBpm = (trackId: string): BpmCacheEntry | null => {
    return bpmCache.value.get(trackId) ?? null;
  };

  /** 评估硬件并设置推荐等级（首次进入时自动选择推荐等级） */
  const evaluateAndRecommend = () => {
    hardwareScore.value = evaluateHardware();
    // 如果用户未手动设置过，自动设置为推荐等级
    if (!localStorage.getItem('mixTransitionLevel')) {
      transitionLevel.value = hardwareScore.value.level;
      localStorage.setItem('mixTransitionLevel', String(hardwareScore.value.level));
    }
  };

  return {
    // state
    smartMixEnabled,
    transitionLevel,
    crossfadeDuration,
    bpmPreAnalysis,
    isTransitioning,
    bpmCache,
    hardwareScore,
    // computed
    recommendedLevel,
    currentBpm,
    // actions
    setSmartMixEnabled,
    setTransitionLevel,
    setCrossfadeDuration,
    setBpmPreAnalysis,
    setTransitioning,
    cacheBpm,
    getCachedBpm,
    evaluateAndRecommend,
  };
});
