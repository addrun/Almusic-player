/**
 * 鼓点检测器 (DrumDetector)
 *
 * 通过分析音频信号的频谱变化（spectral flux）和低频能量突变，
 * 实时检测鼓点（kick/snare）并估算 BPM。
 *
 * 原理:
 *   1. 频谱通量 (Spectral Flux): 相邻帧频谱的正向差异之和
 *      - 鼓点会导致频谱在短时间内剧烈变化
 *   2. 低频能量检测: 专门分析 60~200Hz（kick drum）的能量突增
 *   3. 自适应阈值: 使用滚动平均的频谱通量作为动态基准
 *   4. 冷却期: 防止同一个鼓点被重复检测
 *   5. BPM 估算: 统计鼓点间隔的中位数
 *
 * 用法:
 *   import { drumDetector } from '@/services/drumDetector';
 *   drumDetector.connect(audioContext, sourceNode);
 *   drumDetector.start();
 *   drumDetector.onBeat((info) => console.log('鼓点!', info.bpm));
 */

/** 鼓点检测配置 */
export interface DrumDetectorConfig {
  /** FFT 大小，必须为 2 的幂，默认 1024 */
  fftSize?: number;
  /** 时间平滑常数 (0~1)，默认 0.3（较低值 = 更灵敏） */
  smoothingTimeConstant?: number;
  /** 频谱通量阈值倍数（超过滚动均值的倍数才触发），默认 1.5 */
  fluxThresholdMultiplier?: number;
  /** 低频能量阈值倍数，默认 1.8 */
  kickThresholdMultiplier?: number;
  /** 鼓点冷却时间（毫秒），防止重复检测，默认 100ms */
  cooldownMs?: number;
  /** 滚动窗口大小（帧数），用于计算自适应阈值，默认 43 帧（约 0.7s @60fps） */
  rollingWindowSize?: number;
  /** 每 N 帧分析一次，默认 1（每帧都分析以保证精度） */
  analysisInterval?: number;
  /** BPM 估算的最小间隔（毫秒），默认 250（对应 240 BPM） */
  minBeatIntervalMs?: number;
  /** BPM 估算的最大间隔（毫秒），默认 1500（对应 40 BPM） */
  maxBeatIntervalMs?: number;
  /** BPM 平滑窗口大小（最近 N 个间隔），默认 12 */
  bpmWindowSize?: number;
}

/** 鼓点事件信息 */
export interface BeatInfo {
  /** 估算的 BPM */
  bpm: number;
  /** 当前频谱通量 (0~1) */
  flux: number;
  /** 低频能量 (0~1) */
  kickEnergy: number;
  /** 是否为强拍（能量特别高） */
  isStrong: boolean;
  /** 当前时间戳 (ms) */
  timestamp: number;
}

/** 鼓点回调 */
export type BeatCallback = (info: BeatInfo) => void;

/**
 * DrumDetector 鼓点检测器
 */
class DrumDetector {
  // ==================== 公开状态 ====================

  /** 当前 BPM */
  public bpm = 0;

  /** 当前频谱通量 */
  public flux = 0;

  /** 当前低频能量 */
  public kickEnergy = 0;

  /** 是否正在检测 */
  public running = false;

  // ==================== 内部状态 ====================

  private context: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private upstreamNode: AudioNode | null = null;

  /** 频域数据缓冲区 */
  private frequencyData: Uint8Array = new Uint8Array(0);
  /** 上一帧的频域数据（用于计算频谱通量） */
  private prevFrequencyData: Float32Array = new Float32Array(0);

  /** 频谱通量历史 */
  private fluxHistory: number[] = [];
  /** 低频能量历史 */
  private kickHistory: number[] = [];
  /** 鼓点间隔历史（毫秒） */
  private beatIntervals: number[] = [];
  /** 上一次鼓点时间戳 */
  private lastBeatTime = 0;
  /** 上次冷却结束时间 */
  private cooldownEndTime = 0;

  private animationFrameId: number | null = null;
  private frameIndex = 0;

  private beatCallbacks: BeatCallback[] = [];

  private config: Required<DrumDetectorConfig>;

  constructor(config?: DrumDetectorConfig) {
    this.config = {
      fftSize: config?.fftSize ?? 1024,
      smoothingTimeConstant: config?.smoothingTimeConstant ?? 0.3,
      fluxThresholdMultiplier: config?.fluxThresholdMultiplier ?? 1.5,
      kickThresholdMultiplier: config?.kickThresholdMultiplier ?? 1.8,
      cooldownMs: config?.cooldownMs ?? 100,
      rollingWindowSize: config?.rollingWindowSize ?? 43,
      analysisInterval: config?.analysisInterval ?? 1,
      minBeatIntervalMs: config?.minBeatIntervalMs ?? 250,
      maxBeatIntervalMs: config?.maxBeatIntervalMs ?? 1500,
      bpmWindowSize: config?.bpmWindowSize ?? 12,
    };
  }

  // ==================== 公共接口 ====================

  /**
   * 连接到音频图谱
   */
  public connect(audioContext: AudioContext, sourceNode: AudioNode): void {
    this.context = audioContext;
    this.upstreamNode = sourceNode;

    this.analyserNode = this.context.createAnalyser();
    this.analyserNode.fftSize = this.config.fftSize;
    this.analyserNode.smoothingTimeConstant = this.config.smoothingTimeConstant;

    this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.prevFrequencyData = new Float32Array(this.analyserNode.frequencyBinCount);

    this.upstreamNode.connect(this.analyserNode);

  }

  /**
   * 断开连接
   */
  public disconnect(): void {
    this.stop();

    if (this.analyserNode && this.upstreamNode) {
      try { this.upstreamNode.disconnect(this.analyserNode); } catch {}
    }

    this.analyserNode = null;
    this.upstreamNode = null;
    this.context = null;

  }

  /**
   * 启动检测
   */
  public start(): void {
    if (this.animationFrameId !== null) return;
    if (!this.analyserNode) {
      console.error('[DrumDetector] 未连接，请先调用 connect()');
      return;
    }

    this.running = true;
    this.frameIndex = 0;
    this.fluxHistory = [];
    this.kickHistory = [];
    this.beatIntervals = [];
    this.lastBeatTime = 0;
    this.cooldownEndTime = 0;
    this.bpm = 0;

    this.analysisLoop();
  }

  /**
   * 停止检测
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.running = false;
  }

  /**
   * 注册鼓点回调
   * @returns 取消注册函数
   */
  public onBeat(callback: BeatCallback): () => void {
    this.beatCallbacks.push(callback);
    return () => {
      this.beatCallbacks = this.beatCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<DrumDetectorConfig>): void {
    Object.assign(this.config, config);
    if (config.rollingWindowSize !== undefined) {
      while (this.fluxHistory.length > config.rollingWindowSize) this.fluxHistory.shift();
      while (this.kickHistory.length > config.rollingWindowSize) this.kickHistory.shift();
    }
  }

  // ==================== 内部方法 ====================

  private analysisLoop = (): void => {
    this.animationFrameId = requestAnimationFrame(this.analysisLoop);

    this.frameIndex++;
    if (this.frameIndex % this.config.analysisInterval !== 0) return;
    if (!this.analyserNode) return;

    // 读取频域数据
    this.analyserNode.getByteFrequencyData(this.frequencyData);

    // 计算频谱通量
    const spectralFlux = this.calculateSpectralFlux(this.frequencyData);

    // 计算低频能量 (kick drum: ~60-200Hz)
    const kickEnergy = this.calculateKickEnergy(this.frequencyData);

    // 更新历史
    this.fluxHistory.push(spectralFlux);
    this.kickHistory.push(kickEnergy);
    if (this.fluxHistory.length > this.config.rollingWindowSize) this.fluxHistory.shift();
    if (this.kickHistory.length > this.config.rollingWindowSize) this.kickHistory.shift();

    // 计算自适应阈值
    const fluxAvg = this.rollingAverage(this.fluxHistory);
    const kickAvg = this.rollingAverage(this.kickHistory);

    this.flux = spectralFlux;
    this.kickEnergy = kickEnergy;

    // 检测鼓点
    const now = performance.now();
    const fluxSpike = spectralFlux > fluxAvg * this.config.fluxThresholdMultiplier;
    const kickSpike = kickEnergy > kickAvg * this.config.kickThresholdMultiplier;
    const cooldownOk = now >= this.cooldownEndTime;

    // 鼓点判定：频谱通量突增 AND (低频突增 OR 频谱通量特别强)
    const isBeat = cooldownOk && fluxSpike && (kickSpike || spectralFlux > fluxAvg * 2.5);

    if (isBeat) {
      // 计算间隔（用于 BPM 估算）
      if (this.lastBeatTime > 0) {
        const interval = now - this.lastBeatTime;
        if (interval >= this.config.minBeatIntervalMs && interval <= this.config.maxBeatIntervalMs) {
          this.beatIntervals.push(interval);
          if (this.beatIntervals.length > this.config.bpmWindowSize) {
            this.beatIntervals.shift();
          }
          this.bpm = this.estimateBPM(this.beatIntervals);
        }
      }

      this.lastBeatTime = now;
      this.cooldownEndTime = now + this.config.cooldownMs;

      const isStrong = kickEnergy > kickAvg * 2.2 || spectralFlux > fluxAvg * 3;

      const info: BeatInfo = {
        bpm: this.bpm,
        flux: spectralFlux,
        kickEnergy,
        isStrong,
        timestamp: now,
      };

      this.beatCallbacks.forEach((cb) => {
        try { cb(info); } catch (e) {
          console.error('[DrumDetector] 回调出错:', e);
        }
      });
    }

    // 存储当前帧数据用于下一帧的频谱通量计算
    for (let i = 0; i < this.frequencyData.length; i++) {
      this.prevFrequencyData[i] = this.frequencyData[i];
    }
  };

  /**
   * 计算频谱通量 (Spectral Flux)
   *
   * 公式: SF = Σ max(0, X[n] - X[n-1])
   * 只计算正向变化（能量增加），忽略衰减。
   * 鼓点会导致多个频率 bin 同时出现能量突增。
   */
  private calculateSpectralFlux(data: Uint8Array): number {
    let flux = 0;
    const len = Math.min(data.length, this.prevFrequencyData.length);
    for (let i = 0; i < len; i++) {
      const diff = data[i] - this.prevFrequencyData[i];
      if (diff > 0) flux += diff;
    }
    // 归一化到 0~1
    return flux / (len * 255);
  }

  /**
   * 计算低频能量 (Kick Drum 频段)
   *
   * Kick drum 的主要频率范围: 60~200Hz
   * 采样率 44100Hz, FFT=1024 → 频率分辨率 ≈ 43Hz/bin
   * 60Hz → bin 1.4, 200Hz → bin 4.65
   * 实际取 bin 1~5（约 43~215Hz）
   *
   * 对于其他 FFT 大小，按比例计算 bin 范围
   */
  private calculateKickEnergy(data: Uint8Array): number {
    if (!this.context || data.length === 0) return 0;

    const sampleRate = this.context.sampleRate;
    const binResolution = sampleRate / (data.length * 2); // 每个 bin 对应的 Hz
    const lowBin = Math.max(1, Math.floor(60 / binResolution));
    const highBin = Math.min(data.length - 1, Math.ceil(200 / binResolution));

    let sum = 0;
    let count = 0;
    for (let i = lowBin; i <= highBin; i++) {
      sum += data[i];
      count++;
    }

    return count > 0 ? sum / count / 255 : 0;
  }

  /**
   * 计算滚动平均值
   */
  private rollingAverage(history: number[]): number {
    if (history.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < history.length; i++) sum += history[i];
    return sum / history.length;
  }

  /**
   * BPM 估算
   *
   * 使用最近 N 个鼓点间隔的中位数来估算 BPM，
   * 中位数比平均值更能抵抗异常值（偶发的漏检/误检）。
   */
  private estimateBPM(intervals: number[]): number {
    if (intervals.length < 2) return 0;

    // 取中位数
    const sorted = [...intervals].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianMs = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

    // ms → BPM
    return Math.round(60000 / medianMs);
  }

  /**
   * 获取三频段能量数据（供 Level 3 频域拼接和 UI 频谱可视化使用）
   *
   * 低频 (20-250Hz): 贝斯/底鼓
   * 中频 (250-4000Hz): 人声/旋律
   * 高频 (4000-20000Hz): 镲片/空气感
   */
  public getBandEnergies(): { low: number; mid: number; high: number } {
    if (!this.context || !this.frequencyData || this.frequencyData.length === 0) {
      return { low: 0, mid: 0, high: 0 };
    }

    const sampleRate = this.context.sampleRate;
    const binResolution = sampleRate / (this.frequencyData.length * 2);

    const lowStart = Math.max(1, Math.floor(20 / binResolution));
    const lowEnd = Math.min(this.frequencyData.length - 1, Math.ceil(250 / binResolution));
    const midEnd = Math.min(this.frequencyData.length - 1, Math.ceil(4000 / binResolution));
    const highEnd = Math.min(this.frequencyData.length - 1, Math.ceil(20000 / binResolution));

    const avgRange = (start: number, end: number): number => {
      let sum = 0;
      let count = 0;
      for (let i = start; i <= end; i++) {
        sum += this.frequencyData[i];
        count++;
      }
      return count > 0 ? sum / count / 255 : 0;
    };

    return {
      low: avgRange(lowStart, lowEnd),
      mid: avgRange(lowEnd + 1, midEnd),
      high: avgRange(midEnd + 1, highEnd)
    };
  }
}

/** 全局单例 */
export const drumDetector = new DrumDetector({
  fftSize: 1024,
  smoothingTimeConstant: 0.3,
  fluxThresholdMultiplier: 1.5,
  kickThresholdMultiplier: 1.8,
  cooldownMs: 100,
  rollingWindowSize: 43,
  analysisInterval: 1,
  minBeatIntervalMs: 250,
  maxBeatIntervalMs: 1500,
  bpmWindowSize: 12,
});

export default drumDetector;
