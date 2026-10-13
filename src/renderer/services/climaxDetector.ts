/**
 * 高潮检测器 (ClimaxDetector)
 *
 * 通过分析音频信号的能量（RMS）和频谱覆盖度，实时检测音乐高潮段落。
 * 连接到现有的 Web Audio API 图谱，在 EQ 滤波器链和 GainNode 之间插入分析节点。
 *
 * 依赖:
 *   - 现有 audioService 中的 AudioContext
 *   - Web Audio API (AnalyserNode)
 *
 * 使用方式:
 *   const detector = climaxDetector;
 *   detector.connect(audioContext, sourceNode);
 *   detector.start();
 *   detector.onClimax((energy) => {
 *     console.log('高潮检测到! 能量:', energy);
 *   });
 */

/** 高潮检测器配置接口 */
export interface ClimaxDetectorConfig {
  /** 能量阈值：当前能量超过滚动平均值的倍数时触发高潮判定，默认 1.4 */
  energyThreshold?: number;
  /** 频谱覆盖度阈值：低/中/高频段均活跃的比例，默认 0.7 (70%) */
  spectrumCoverageThreshold?: number;
  /** 高潮触发后的冷却时间（毫秒），默认 3000ms */
  cooldownMs?: number;
  /** 滚动平均能量的采样窗口大小，默认 60 帧（约 1 秒 @60fps） */
  rollingWindowSize?: number;
  /** 分析缓冲区大小（FFT 大小），必须为 2 的幂，默认 2048 */
  fftSize?: number;
  /** 动画帧率控制：每 N 帧进行一次分析，默认 2（约 30fps） */
  analysisInterval?: number;
}

/** 高潮回调函数类型 */
export type ClimaxCallback = (energy: number) => void;

/**
 * ClimaxDetector 类
 *
 * 实时分析音频能量和频谱覆盖度，检测音乐高潮段落。
 * 使用响应式数据结构，外部可通过 isClimax / energyLevel / spectrumCoverage 订阅状态变化。
 */
class ClimaxDetector {
  // ======================== 响应式状态 ========================

  /** 是否处于高潮状态 */
  public isClimax = false;

  /** 当前能量级别（0~2，1.0 为正常水平） */
  public energyLevel = 0;

  /** 当前频谱覆盖度（0~1，1 表示全频段活跃） */
  public spectrumCoverage = 0;

  // ======================== 内部状态 ========================

  /** Web Audio API 上下文引用 */
  private context: AudioContext | null = null;

  /** 音频分析节点（FFT 分析器） */
  private analyserNode: AnalyserNode | null = null;

  /** 上游节点（EQ 滤波器链的最后一个节点或 source） */
  private upstreamNode: AudioNode | null = null;

  /** 下游节点（GainNode） */
  private downstreamNode: GainNode | null = null;

  /** 频域数据缓冲区 */
  private frequencyData: Uint8Array = new Uint8Array(0);

  /** 时域数据缓冲区（用于 RMS 计算） */
  private timeDomainData: Uint8Array = new Uint8Array(0);

  /** 滚动能量历史（用于计算动态平均值） */
  private energyHistory: number[] = [];

  /** 当前帧索引（用于分析间隔控制） */
  private frameIndex = 0;

  /** 分析间隔（每 N 帧分析一次） */
  private analysisInterval = 2;

  /** 动画帧 ID，用于取消 rAF */
  private animationFrameId: number | null = null;

  /** 上次高潮触发时间戳 */
  private lastClimaxTime = 0;

  /** 高潮回调函数列表 */
  private climaxCallbacks: ClimaxCallback[] = [];

  /** 配置参数 */
  private config: Required<ClimaxDetectorConfig>;

  /** 频段划分：低频、中频、高频的分界点（Hz） */
  private static readonly BAND_RANGES = {
    low: { start: 0, end: 0.25 },     // 0~25% 频段为低频
    mid: { start: 0.25, end: 0.65 },  // 25~65% 频段为中频
    high: { start: 0.65, end: 1.0 }   // 65~100% 频段为高频
  };

  constructor(config?: ClimaxDetectorConfig) {
    this.config = {
      energyThreshold: config?.energyThreshold ?? 1.4,
      spectrumCoverageThreshold: config?.spectrumCoverageThreshold ?? 0.7,
      cooldownMs: config?.cooldownMs ?? 3000,
      rollingWindowSize: config?.rollingWindowSize ?? 60,
      fftSize: config?.fftSize ?? 2048,
      analysisInterval: config?.analysisInterval ?? 2
    };
    this.analysisInterval = this.config.analysisInterval;
  }

  // ======================== 公共接口 ========================

  /**
   * 连接到现有的 Web Audio API 图谱
   *
   * 在 EQ 滤波器链的末端和 GainNode 之间插入 AnalyserNode。
   * 这样分析器可以获取经过 EQ 处理后的音频信号，同时不影响音质。
   *
   * 连接拓扑:
   *   ... → filters[last] → analyserNode → gainNode → destination
   *                     ↘ (旁路，分析器不影响主音频路径)
   *
   * @param audioContext - 现有的 AudioContext 实例
   * @param sourceNode - 上游音频节点（EQ 链最后一个滤波器或 source）
   */
  public connect(audioContext: AudioContext, sourceNode: AudioNode): void {
    this.context = audioContext;
    this.upstreamNode = sourceNode;

    // 创建分析节点（使用默认配置，connect 后可调整）
    this.analyserNode = this.context.createAnalyser();
    this.analyserNode.fftSize = this.config.fftSize;
    this.analyserNode.smoothingTimeConstant = 0.8; // 时间平滑常数

    // 初始化数据缓冲区
    this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.analyserNode.frequencyBinCount);

    // 将分析节点连接到上游（只读监听，不改变音频路径）
    // 注意：AnalyserNode 是只读的，不会消耗或修改音频数据
    this.upstreamNode.connect(this.analyserNode);

    // 存储下游 GainNode 引用（用于后续可能的断开/重连）
    // 当前实现中 analyserNode 仅作为旁路监听，不插入主路径
    this.downstreamNode = null;

  }

  /**
   * 断开与音频图谱的连接并清理资源
   */
  public disconnect(): void {
    this.stop();

    if (this.analyserNode && this.upstreamNode) {
      try {
        this.upstreamNode.disconnect(this.analyserNode);
      } catch (e) {
        // 忽略已断开的错误
      }
    }

    this.analyserNode = null;
    this.upstreamNode = null;
    this.downstreamNode = null;
    this.context = null;

  }

  /**
   * 启动高潮检测
   *
   * 开始以 requestAnimationFrame 驱动的分析循环。
   * 每帧计算 RMS 能量和频谱覆盖度，当满足高潮条件时触发回调。
   */
  public start(): void {
    if (this.animationFrameId !== null) {
      console.warn('[ClimaxDetector] 检测已运行中，忽略重复调用');
      return;
    }

    if (!this.analyserNode) {
      console.error('[ClimaxDetector] 未连接音频图谱，请先调用 connect()');
      return;
    }

    this.frameIndex = 0;
    this.lastClimaxTime = 0;
    this.energyHistory = [];
    this.analysisLoop();

  }

  /**
   * 停止高潮检测
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 重置状态
    this.isClimax = false;
    this.energyLevel = 0;
    this.spectrumCoverage = 0;

  }

  /**
   * 注册高潮回调
   *
   * @param callback - 高潮触发时的回调函数，接收当前能量值
   * @returns 取消注册的函数
   */
  public onClimax(callback: ClimaxCallback): () => void {
    this.climaxCallbacks.push(callback);

    // 返回取消注册函数
    return () => {
      this.climaxCallbacks = this.climaxCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * 更新配置参数（可在运行时动态调整）
   */
  public updateConfig(config: Partial<ClimaxDetectorConfig>): void {
    if (config.energyThreshold !== undefined) {
      this.config.energyThreshold = config.energyThreshold;
    }
    if (config.spectrumCoverageThreshold !== undefined) {
      this.config.spectrumCoverageThreshold = config.spectrumCoverageThreshold;
    }
    if (config.cooldownMs !== undefined) {
      this.config.cooldownMs = config.cooldownMs;
    }
    if (config.rollingWindowSize !== undefined) {
      this.config.rollingWindowSize = config.rollingWindowSize;
      // 如果窗口大小改变，裁剪历史
      while (this.energyHistory.length > config.rollingWindowSize) {
        this.energyHistory.shift();
      }
    }
    if (config.fftSize !== undefined && this.analyserNode) {
      this.config.fftSize = config.fftSize;
      this.analyserNode.fftSize = config.fftSize;
      this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.timeDomainData = new Uint8Array(this.analyserNode.frequencyBinCount);
    }
    if (config.analysisInterval !== undefined) {
      this.config.analysisInterval = config.analysisInterval;
      this.analysisInterval = config.analysisInterval;
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): Readonly<Required<ClimaxDetectorConfig>> {
    return { ...this.config };
  }

  // ======================== 内部方法 ========================

  /**
   * 主分析循环
   *
   * 使用 requestAnimationFrame 驱动，但通过 analysisInterval 控制实际分析频率。
   * 这样可以保持动画帧的连续性（用于 UI 更新），同时降低分析计算的开销。
   *
   * 动画性能提示:
   *   - 仅在 isClimax 状态变化时改变元素的 will-change 属性
   *   - 使用 autoAlpha 而非 opacity 进行显隐控制
   *   - 自定义 cubic-bezier 缓动曲线，避免使用默认 ease-in-out
   */
  private analysisLoop = (): void => {
    this.animationFrameId = requestAnimationFrame(this.analysisLoop);

    // 按间隔执行分析（减少 CPU 开销）
    this.frameIndex++;
    if (this.frameIndex % this.analysisInterval !== 0) return;

    if (!this.analyserNode) return;

    // 读取时域数据（用于 RMS 计算）
    this.analyserNode.getByteTimeDomainData(this.timeDomainData);

    // 读取频域数据（用于频谱覆盖度计算）
    this.analyserNode.getByteFrequencyData(this.frequencyData);

    // 计算 RMS 能量
    const rmsEnergy = this.calculateRMS(this.timeDomainData);

    // 将 RMS 归一化到 0~2 范围（1.0 代表正常音量）
    const normalizedEnergy = Math.min(2, rmsEnergy * 2);

    // 更新滚动能量历史
    this.energyHistory.push(normalizedEnergy);
    if (this.energyHistory.length > this.config.rollingWindowSize) {
      this.energyHistory.shift();
    }

    // 计算滚动平均能量
    const rollingAvg = this.calculateRollingAverage();

    // 更新能量级别
    this.energyLevel = rollingAvg > 0 ? normalizedEnergy / rollingAvg : 0;

    // 计算频谱覆盖度
    this.spectrumCoverage = this.calculateSpectrumCoverage(this.frequencyData);

    // 判断是否触发高潮
    const now = Date.now();
    const cooldownElapsed = now - this.lastClimaxTime >= this.config.cooldownMs;

    if (
      cooldownElapsed &&
      normalizedEnergy > rollingAvg * this.config.energyThreshold &&
      this.spectrumCoverage > this.config.spectrumCoverageThreshold
    ) {
      this.isClimax = true;
      this.lastClimaxTime = now;

      // 触发所有注册的回调
      this.climaxCallbacks.forEach((cb) => {
        try {
          cb(normalizedEnergy);
        } catch (e) {
          console.error('[ClimaxDetector] 回调执行出错:', e);
        }
      });
    } else {
      // 能量回落到正常范围时结束高潮状态
      if (this.isClimax && normalizedEnergy < rollingAvg * 1.1) {
        this.isClimax = false;
      }
    }
  };

  /**
   * 计算时域信号的 RMS（均方根）能量
   *
   * RMS 是衡量音频信号平均能量的标准方法：
   *   RMS = sqrt( (1/N) * Σ(x[i]^2) )
   *
   * @param timeDomainData - 无符号 8 位时域数据（0~255，128 为静音）
   * @returns 归一化后的 RMS 值（0~1）
   */
  private calculateRMS(timeDomainData: Uint8Array): number {
    let sumOfSquares = 0;

    for (let i = 0; i < timeDomainData.length; i++) {
      // 将 0~255 映射到 -1~1（128 为零点）
      const normalized = (timeDomainData[i] - 128) / 128;
      sumOfSquares += normalized * normalized;
    }

    return Math.sqrt(sumOfSquares / timeDomainData.length);
  }

  /**
   * 计算滚动平均能量
   *
   * 使用最近 N 帧的能量历史来计算动态平均值。
   * 这比固定阈值更能适应不同音量的音乐。
   */
  private calculateRollingAverage(): number {
    if (this.energyHistory.length === 0) return 1; // 默认返回 1（正常能量）

    let sum = 0;
    for (let i = 0; i < this.energyHistory.length; i++) {
      sum += this.energyHistory[i];
    }

    return sum / this.energyHistory.length;
  }

  /**
   * 计算频谱覆盖度
   *
   * 将频谱分为低频、中频、高频三个区域。
   * 覆盖度 = (活跃频段数 / 3)，其中"活跃"定义为该频段内
   * 至少有 30% 的频率 bin 超过静音阈值。
   *
   * @param frequencyData - 无符号 8 位频域数据（0~255）
   * @returns 覆盖度值（0~1）
   */
  private calculateSpectrumCoverage(frequencyData: Uint8Array): number {
    if (frequencyData.length === 0) return 0;

    const totalBins = frequencyData.length;
    const silentThreshold = 20; // 静音阈值（0~255）
    const activeRatioThreshold = 0.3; // 频段内活跃 bin 的比例阈值

    let activeBands = 0;

    // 低频区域
    const lowStart = Math.floor(totalBins * ClimaxDetector.BAND_RANGES.low.start);
    const lowEnd = Math.floor(totalBins * ClimaxDetector.BAND_RANGES.low.end);
    if (this.isBandActive(frequencyData, lowStart, lowEnd, silentThreshold, activeRatioThreshold)) {
      activeBands++;
    }

    // 中频区域
    const midStart = Math.floor(totalBins * ClimaxDetector.BAND_RANGES.mid.start);
    const midEnd = Math.floor(totalBins * ClimaxDetector.BAND_RANGES.mid.end);
    if (this.isBandActive(frequencyData, midStart, midEnd, silentThreshold, activeRatioThreshold)) {
      activeBands++;
    }

    // 高频区域
    const highStart = Math.floor(totalBins * ClimaxDetector.BAND_RANGES.high.start);
    const highEnd = Math.floor(totalBins * ClimaxDetector.BAND_RANGES.high.end);
    if (this.isBandActive(frequencyData, highStart, highEnd, silentThreshold, activeRatioThreshold)) {
      activeBands++;
    }

    return activeBands / 3;
  }

  /**
   * 判断某个频段是否活跃
   *
   * @param data - 频域数据
   * @param start - 起始 bin 索引
   * @param end - 结束 bin 索引
   * @param threshold - 静音阈值
   * @param requiredRatio - 活跃比例要求
   * @returns 该频段是否活跃
   */
  private isBandActive(
    data: Uint8Array,
    start: number,
    end: number,
    threshold: number,
    requiredRatio: number
  ): boolean {
    if (start >= end || start >= data.length) return false;

    let activeCount = 0;
    const totalBins = end - start;

    for (let i = start; i < end && i < data.length; i++) {
      if (data[i] > threshold) {
        activeCount++;
      }
    }

    return activeCount / totalBins >= requiredRatio;
  }
}

// ======================== 单例导出 ========================

/**
 * 全局单例实例
 *
 * 在整个应用中使用同一个 ClimaxDetector 实例。
 * 这样可以避免多个实例竞争 AudioContext 资源。
 *
 * @example
 * ```typescript
 * import { climaxDetector } from '@/services/climaxDetector';
 *
 * // 连接到音频图谱
 * climaxDetector.connect(audioContext, eqLastFilter);
 *
 * // 启动检测
 * climaxDetector.start();
 *
 * // 监听高潮事件
 * const unsubscribe = climaxDetector.onClimax((energy) => {
 *   console.log('高潮触发，能量:', energy);
 *   // 在这里触发舞台动画
 * });
 *
 * // 清理
 * unsubscribe();
 * climaxDetector.stop();
 * climaxDetector.disconnect();
 * ```
 */
export const climaxDetector = new ClimaxDetector({
  energyThreshold: 1.4,
  spectrumCoverageThreshold: 0.7,
  cooldownMs: 3000,
  rollingWindowSize: 60,
  fftSize: 2048,
  analysisInterval: 2
});

export default climaxDetector;
