/**
 * useSmartAudio — 智能混音引擎 composable
 *
 * 整合层：协调 audioService、scheduler、crossfade、bpm worker
 * 不创建新的 AudioContext，复用 Howler.ctx
 *
 * 三级递进过渡策略：
 *   Level 1 — 等功率淡入淡出（余弦曲线）
 *   Level 2 — BPM 节拍对齐（Web Worker 离线 BPM + 乐句边界对齐）
 *   Level 3 — 时频域智能拼接（三频段独立淡出曲线）
 *
 * 架构说明：
 *   真正的音频图（source / gainNode / crossfadeGain / 清理）由 audioService 管理。
 *   本 composable 只负责「曲线策略」与「BPM 预分析」「精准调度」。
 *   audioService.crossfadeToNext 会在过渡时把真实的 gainOut / gainIn 传给 crossfadeTo，
 *   由本处的三级策略决定如何驱动这两条 gain。
 */

import { Howler } from 'howler';
import { computed, ref, shallowRef } from 'vue';

import { audioService } from '@/services/audioService';
import { type BpmCacheEntry,useMixEngineStore } from '@/store/modules/mixEngine';
import { isElectron } from '@/utils';
import { applyBandSplitCrossfade, type BandSplitChain,createBandSplitChain } from '@/utils/audio/bandSplitter';
import { calculateBeatAlignedTransition } from '@/utils/audio/beatAlign';
import { applyEqualPowerCrossfade } from '@/utils/audio/crossfade';
import { AudioScheduler } from '@/utils/audio/scheduler';

export interface CrossfadeResult {
  level: 1 | 2 | 3;
  startTime: number;
  duration: number;
  reason: string;
}

export interface CrossfadeOptions {
  gainOut: GainNode;       // 当前歌曲的输出 gain（audioService.gainNode）
  gainIn: GainNode;        // 下一首的 crossfade gain（audioService.crossfadeGain）
  masterGain: AudioNode | null; // 最终输出节点（ctx.destination 或 Howler.masterGain），Level 3 需要
  duration: number;       // 期望过渡时长（秒）
  level: 1 | 2 | 3;
  currentTime: number;    // 当前歌曲播放位置（秒）
  remainingTime: number;  // 当前歌曲剩余时间（秒）
  nextTrackId: string;    // 下一首 ID（用于 BPM 缓存）
  volume: number;         // 用户音量（0~1），曲线终值会缩放至此
}

// ==================== 单例桥接 ====================
// useSmartAudio 必须在组件 setup 中调用（依赖 onMounted 等可选生命周期），
// 但 smartMixService / audioService 处于组件之外，需要一个全局句柄来访问引擎实例。
let smartAudioInstance: ReturnType<typeof useSmartAudio> | null = null;

export function setSmartAudioInstance(instance: ReturnType<typeof useSmartAudio>) {
  smartAudioInstance = instance;
}

export function getSmartAudio(): ReturnType<typeof useSmartAudio> | null {
  return smartAudioInstance;
}

export function useSmartAudio() {
  const mixEngine = useMixEngineStore();

  // ==================== 内部状态 ====================
  const ctx = computed<AudioContext | null>(() => audioService.getAudioContext());
  const scheduler = shallowRef<AudioScheduler | null>(null);
  const bpmWorker = shallowRef<Worker | null>(null);
  const initialized = ref(false);
  const workerInitFailed = ref(false);

  // 是否正在过渡
  const isTransitioning = computed(() => mixEngine.isTransitioning);

  const currentTrackId = ref<string | null>(null);

  // ==================== 初始化 ====================

  /**
   * 懒初始化：创建 AudioScheduler 与 BPM Worker。
   * 可安全重复调用。
   *
   * 必须在 AudioContext 已就绪后调用，否则跳过等待后续触发。
   */
  function ensureInit(): boolean {
    if (initialized.value && scheduler.value) return true;

    const audioCtx = ctx.value || (Howler.ctx as AudioContext);
    if (!audioCtx) return false;

    if (!scheduler.value) {
      scheduler.value = new AudioScheduler(audioCtx);
      scheduler.value.start();
    } else if (scheduler.value['ctx' as keyof AudioScheduler] !== audioCtx) {
      // 上下文切换时重建调度器
      try { scheduler.value.stop(); } catch { /* 已停止 */ }
      scheduler.value = new AudioScheduler(audioCtx);
      scheduler.value.start();
    }

    if (mixEngine.bpmPreAnalysis && !bpmWorker.value && !workerInitFailed.value) {
      initBpmWorker();
    }

    // 硬件评估（仅首次）
    if (!mixEngine.hardwareScore) {
      mixEngine.evaluateAndRecommend();
    }

    initialized.value = true;
    return true;
  }

  // 兼容原有 onMounted 入口；也可由外部直接调用
  function init() {
    ensureInit();
  }

  // ==================== BPM Worker ====================

  function initBpmWorker() {
    if (bpmWorker.value) return;
    try {
      const worker = new Worker(
        new URL('@/workers/bpmAnalyzer.worker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'result') {
          const { bpm, confidence, beatOffset } = e.data;
          if (currentTrackId.value) {
            mixEngine.cacheBpm(currentTrackId.value, { bpm, confidence, beatOffset });
          }
        }
      };
      worker.onerror = () => {
        workerInitFailed.value = true;
      };
      bpmWorker.value = worker;
    } catch (e) {
      console.warn('[useSmartAudio] BPM Worker 初始化失败:', e);
      workerInitFailed.value = true;
    }
  }

  /**
   * 预加载并分析下一首歌的 BPM
   */
  async function preloadAndAnalyzeBpm(trackId: string, url: string) {
    currentTrackId.value = trackId;

    const cached = mixEngine.getCachedBpm(trackId);
    if (cached) return cached;

    ensureInit();
    if (!bpmWorker.value) return null;

    try {
      let arrayBuffer: ArrayBuffer;
      if (isElectron && url.startsWith('local://')) {
        const filePath = url.replace(/^local:\/{2,3}/, '').replace(/%2F/g, '/');
        const result: unknown = await (window as any).electron.ipcRenderer.invoke(
          'read-file-binary',
          decodeURIComponent(filePath)
        );
        if (!result) return null;
        const uint8 = result as Uint8Array;
        arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
      } else if (!url.startsWith('local://')) {
        const response = await fetch(url);
        if (!response.ok) return null;
        arrayBuffer = await response.arrayBuffer();
      } else {
        return null;
      }

      bpmWorker.value.postMessage({ type: 'analyze', arrayBuffer }, [arrayBuffer]);
    } catch (e) {
      console.warn('[useSmartAudio] BPM 预分析失败:', e);
    }
    return null;
  }

  // ==================== Crossfade 策略入口 ====================

  /**
   * 执行智能过渡：在 audioService 提供的真实 gain 节点上应用三级策略
   */
  function crossfadeTo(opts: CrossfadeOptions): CrossfadeResult {
    const audioCtx = ctx.value || (Howler.ctx as AudioContext);
    if (!audioCtx || !ensureInit() || !scheduler.value) {
      // 引擎未就绪，回退到最简等功率（仍按用户音量缩放）
      const fallbackCtx = audioCtx;
      if (fallbackCtx) {
        applyEqualPowerCrossfade(fallbackCtx, opts.gainOut, opts.gainIn, fallbackCtx.currentTime, opts.duration, opts.volume);
      }
      return { level: 1, startTime: fallbackCtx?.currentTime ?? 0, duration: opts.duration, reason: '智能引擎未就绪，等功率回退' };
    }

    mixEngine.setTransitioning(true);

    const now = audioCtx.currentTime;
    const level = opts.level;

    // ---------- Level 1: 等功率淡入淡出 ----------
    if (level === 1) {
      applyEqualPowerCrossfade(audioCtx, opts.gainOut, opts.gainIn, now, opts.duration, opts.volume);
      return { level: 1, startTime: now, duration: opts.duration, reason: `等功率 crossfade ${opts.duration}s` };
    }

    // ---------- Level 2/3: 取 BPM ----------
    let bpm = 0;
    let beatOffset = 0;
    const cached = mixEngine.getCachedBpm(opts.nextTrackId);
    if (cached) {
      bpm = cached.bpm;
      beatOffset = cached.beatOffset;
    } else {
      bpm = audioService.getRealtimeBpm();
    }

    // ---------- Level 2: BPM 节拍对齐 ----------
    if (level === 2) {
      const result = calculateBeatAlignedTransition({
        bpm,
        beatOffset,
        currentTime: opts.currentTime,
        remainingTime: opts.remainingTime,
        ctx: audioCtx,
        gainOut: opts.gainOut,
        gainIn: opts.gainIn,
        defaultDuration: opts.duration,
        volumeScale: opts.volume
      });

      // 若策略给出的是「未来」开始时间（乐句边界对齐），由于下一首的 audio 实例
      // 已在外层立即 play()，无法延迟其起始位置，这里降级为立即开始以避免新歌
      // 静音推进造成的错位。
      if (result.startTime > now + 0.05) {
        applyEqualPowerCrossfade(audioCtx, opts.gainOut, opts.gainIn, now, result.duration, opts.volume);
        return {
          level: 1,
          startTime: now,
          duration: result.duration,
          reason: `BPM=${bpm}，乐句对齐需延迟但已立即启动，等功率 ${result.duration.toFixed(1)}s`
        };
      }
      return { level: result.level as 1 | 2, startTime: result.startTime, duration: result.duration, reason: result.reason };
    }

    // ---------- Level 3: 时频域智能拼接 ----------
    if (opts.masterGain) {
      return applyLevel3(audioCtx, opts, now);
    }

    // ---------- 降级 Level 1 ----------
    applyEqualPowerCrossfade(audioCtx, opts.gainOut, opts.gainIn, now, opts.duration, opts.volume);
    return { level: 1, startTime: now, duration: opts.duration, reason: '降级为等功率' };
  }

  /** Level 3 实现：在 gainOut / gainIn 与 masterGain 之间插入频段分裂链 */
  function applyLevel3(audioCtx: AudioContext, opts: CrossfadeOptions, now: number): CrossfadeResult {
    const masterGain = opts.masterGain!;
    const duration = opts.duration;
    const destination = audioCtx.destination;

    // 让外层 gain 节点变成 _passthrough（音量交给频段 gain 缩放，避免双重乘积）
    opts.gainOut.gain.cancelScheduledValues(now);
    opts.gainOut.gain.setValueAtTime(1, now);
    opts.gainIn.gain.cancelScheduledValues(now);
    opts.gainIn.gain.setValueAtTime(1, now);

    // 断开 gain 与 ctx.destination 的直连，改走频段分裂链
    // （audioService 中 gainNode 与 crossfadeGain 都直连 ctx.destination）
    try { opts.gainOut.disconnect(destination); } catch { /* 可能未连接 */ }
    try { opts.gainIn.disconnect(destination); } catch { /* 可能未连接 */ }

    const chainOut: BandSplitChain = createBandSplitChain(audioCtx, opts.gainOut);
    const chainIn: BandSplitChain = createBandSplitChain(audioCtx, opts.gainIn);
    const outVol = audioCtx.createGain();
    outVol.gain.value = 1;
    const inVol = audioCtx.createGain();
    inVol.gain.value = 1;
    chainOut.output.connect(outVol);
    outVol.connect(masterGain);
    chainIn.output.connect(inVol);
    inVol.connect(masterGain);

    applyBandSplitCrossfade(audioCtx, chainOut, chainIn, now, duration, opts.volume);

    // 过渡结束后拆除频段链。
    // 注意：不要在这里重连 gainIn → masterGain，否则会与 audioService
    // 的 completeCrossfadeCleanup（同时间点的 setTimeout）争抢 audioService.crossfadeGain
    // 的连接权，可能在新 EQ 链建立后仍残留一条直连，造成双声道输出。
    // 新歌曲的输出路径由 completeCrossfadeCleanup → setupEQ 重建（source → 新 gainNode → destination）。
    scheduler.value?.scheduleAt(now + duration + 0.2, () => {
      disconnectChain(chainOut);
      try { outVol.disconnect(); } catch { /* 已断开 */ }
      disconnectChain(chainIn);
      try { inVol.disconnect(); } catch { /* 已断开 */ }
      mixEngine.setTransitioning(false);
    }, 'cleanup-band-split');

    return {
      level: 3,
      startTime: now,
      duration,
      reason: `频域拼接 ${duration}s（低频晚淡出/中频早淡出/高频中等）`
    };
  }

  /** 断开频段分裂链上的所有节点 */
  function disconnectChain(chain: BandSplitChain) {
    try { chain.low.gain.disconnect(); } catch { /* 已断开 */ }
    try { chain.mid.gain.disconnect(); } catch { /* 已断开 */ }
    try { chain.high.gain.disconnect(); } catch { /* 已断开 */ }
    try { chain.low.filter.disconnect(); } catch { /* 已断开 */ }
    try { chain.mid.filter.disconnect(); } catch { /* 已断开 */ }
    try { chain.high.filter.disconnect(); } catch { /* 已断开 */ }
    try { chain.output.disconnect(); } catch { /* 已断开 */ }
  }

  /** 调度器兜底：transition 结束时确保 isTransitioning 复位（Level 1/2 路径用） */
  function scheduleTransitionEnd(duration: number) {
    const audioCtx = ctx.value || (Howler.ctx as AudioContext);
    if (!audioCtx || !scheduler.value) {
      setTimeout(() => mixEngine.setTransitioning(false), duration * 1000 + 200);
      return;
    }
    scheduler.value.scheduleAt(audioCtx.currentTime + duration + 0.15, () => {
      mixEngine.setTransitioning(false);
    }, 'transition-end');
  }

  // ==================== 频谱数据 ====================

  function getBandEnergies() {
    return audioService.getBandEnergies();
  }

  function getRealtimeBpm() {
    return audioService.getRealtimeBpm();
  }

  function getCachedBpm(trackId: string): BpmCacheEntry | null {
    return mixEngine.getCachedBpm(trackId);
  }

  // ==================== 生命周期 ====================
  // 不依赖组件 onMounted，由调用方（App.vue）触发 init；
  // 也可在 crossfadeTo 内懒触发，保证 AudioContext 就绪后再创建调度器。
  init();

  function dispose() {
    try { scheduler.value?.stop(); } catch { /* 已停止 */ }
    bpmWorker.value?.terminate();
  }

  return {
    // 状态
    isTransitioning,
    // 引擎操作
    init,
    ensureInit,
    crossfadeTo,
    preloadAndAnalyzeBpm,
    scheduleTransitionEnd,
    dispose,
    // 频谱 & BPM
    getBandEnergies,
    getRealtimeBpm,
    getCachedBpm,
  };
}