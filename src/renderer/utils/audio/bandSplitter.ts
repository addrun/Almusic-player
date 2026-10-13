/**
 * bandSplitter.ts — Level 3: 时频域智能拼接
 *
 * 使用 BiquadFilterNode 将音频拆分为 3 个频段，
 * 对每个频段独立控制淡出曲线：
 *   低频 (20-250Hz)：晚淡出（保留节奏感）
 *   中频 (250-4000Hz)：早淡出（避免人声打架）
 *   高频 (4000-20000Hz)：中等淡出（平滑过渡）
 *
 * 使用 setTargetAtTime 实现指数衰减，比线性更自然。
 */

// 频段定义
export const BAND_SPLITPOINTS = {
  lowMid: 250,     // 低频/中频分界
  midHigh: 4000    // 中频/高频分界
};

// 各频段淡出时机（0~1，相对于过渡时长的比例）
export const BAND_FADE_TIMING = {
  low:  { fadeOutStart: 0.7, fadeInStart: 0.8 },  // 低频：70% 淡出，80% 淡入
  mid:  { fadeOutStart: 0.2, fadeInStart: 0.3 },  // 中频：20% 淡出（早），30% 淡入
  high: { fadeOutStart: 0.5, fadeInStart: 0.5 },  // 高频：50% 淡出，50% 淡入
};

/** 频段分裂器：为指定 source 创建 3 路滤波器链 */
export interface BandSplitChain {
  low: {
    filter: BiquadFilterNode;
    gain: GainNode;
  };
  mid: {
    filter: BiquadFilterNode;
    gain: GainNode;
  };
  high: {
    filter: BiquadFilterNode;
    gain: GainNode;
  };
  /** 输出节点：连接到 masterGain */
  output: GainNode;
}

/**
 * 为一个 source 创建三频段分裂链
 *
 * source → lowpass(250) → gain_low ─┐
 * source → bandpass(250-4k) → gain_mid ├→ output → masterGain
 * source → highpass(4k) → gain_high ─┘
 *
 * @param ctx AudioContext
 * @param source 输入节点（AudioBufferSourceNode 或 GainNode）
 * @returns 分裂链描述
 */
export function createBandSplitChain(
  ctx: AudioContext,
  source: AudioNode
): BandSplitChain {
  // 低频：lowpass 250Hz
  const lowFilter = ctx.createBiquadFilter();
  lowFilter.type = 'lowpass';
  lowFilter.frequency.value = BAND_SPLITPOINTS.lowMid;
  lowFilter.Q.value = 0.7;

  // 中频：bandpass 250~4000Hz（用 lowpass + highpass 串联实现，因为 BiquadFilter 的 bandpass 模式 Q 值不够灵活）
  // 实际上用 lowpass(4000) → highpass(250) 串联
  const midFilterLow = ctx.createBiquadFilter();
  midFilterLow.type = 'lowpass';
  midFilterLow.frequency.value = BAND_SPLITPOINTS.midHigh;
  midFilterLow.Q.value = 0.7;

  const midFilterHigh = ctx.createBiquadFilter();
  midFilterHigh.type = 'highpass';
  midFilterHigh.frequency.value = BAND_SPLITPOINTS.lowMid;
  midFilterHigh.Q.value = 0.7;

  // 高频：highpass 4000Hz
  const highFilter = ctx.createBiquadFilter();
  highFilter.type = 'highpass';
  highFilter.frequency.value = BAND_SPLITPOINTS.midHigh;
  highFilter.Q.value = 0.7;

  // 各频段独立 Gain
  const lowGain = ctx.createGain();
  const midGain = ctx.createGain();
  const highGain = ctx.createGain();

  // 输出混合
  const output = ctx.createGain();

  // 连接
  // 低频链
  source.connect(lowFilter);
  lowFilter.connect(lowGain);
  lowGain.connect(output);

  // 中频链（串联两个滤波器）
  source.connect(midFilterLow);
  midFilterLow.connect(midFilterHigh);
  midFilterHigh.connect(midGain);
  midGain.connect(output);

  // 高频链
  source.connect(highFilter);
  highFilter.connect(highGain);
  highGain.connect(output);

  return {
    low: { filter: lowFilter, gain: lowGain },
    mid: { filter: midFilterHigh, gain: midGain },  // 返回最后一个滤波器作为代表
    high: { filter: highFilter, gain: highGain },
    output
  };
}

/**
 * 拆除频段分裂链（过渡结束后调用）
 */
export function destroyBandSplitChain(
  source: AudioNode,
  chain: BandSplitChain,
  masterGain: GainNode
): void {
  try {
    // 先断开各频段到 output 的连接
    chain.low.gain.disconnect();
    chain.mid.gain.disconnect();
    chain.high.gain.disconnect();

    // 断开 source 到各滤波器的连接
    chain.low.filter.disconnect();
    chain.mid.filter.disconnect();
    chain.high.filter.disconnect();

    // 断开 output
    chain.output.disconnect();

    // 重新直接连接 source → masterGain
    source.connect(masterGain);
  } catch {
    // 忽略断连错误
  }
}

/**
 * 应用三频段独立淡出/淡入曲线
 *
 * 使用 setTargetAtTime 实现指数衰减，比线性更自然。
 * tau = 时间常数，约等于 -60dB 衰减所需时间的 1/6
 *
 * 注意：调用方应在调用前把 gainOut / gainIn 的 .gain 设为 1（_passthrough），
 * 把音量缩放完全交给频段 gain，避免与外层 EQ gainNode 的用户音量相乘导致双重缩放。
 *
 * @param ctx AudioContext
 * @param chainOut 淡出歌曲的分裂链
 * @param chainIn 淡入歌曲的分裂链
 * @param startTime 过渡开始时间（AudioContext.currentTime）
 * @param duration 过渡时长（秒）
 * @param volumeScale 音量缩放（0~1），各频段起始/目标值会乘以该系数
 */
export function applyBandSplitCrossfade(
  ctx: AudioContext,
  chainOut: BandSplitChain,
  chainIn: BandSplitChain,
  startTime: number,
  duration: number,
  volumeScale: number = 1
): void {
  const tau = duration / 3;  // 时间常数
  const v = Math.max(0, Math.min(1, volumeScale));

  // === 淡出歌曲 A ===
  // 起始值设为音量缩放（保持过渡前响度连续）
  chainOut.low.gain.setValueAtTime(v, startTime);
  chainOut.mid.gain.setValueAtTime(v, startTime);
  chainOut.high.gain.setValueAtTime(v, startTime);

  // 低频：在过渡段 70% 处开始衰减
  chainOut.low.gain.setTargetAtTime(0, startTime + duration * BAND_FADE_TIMING.low.fadeOutStart, tau);
  // 中频：在过渡段 20% 处开始衰减（早淡出，避免人声打架）
  chainOut.mid.gain.setTargetAtTime(0, startTime + duration * BAND_FADE_TIMING.mid.fadeOutStart, tau);
  // 高频：在过渡段 50% 处衰减
  chainOut.high.gain.setTargetAtTime(0, startTime + duration * BAND_FADE_TIMING.high.fadeOutStart, tau);

  // === 淡入歌曲 B ===
  // 初始值设为 0
  chainIn.low.gain.setValueAtTime(0, startTime);
  chainIn.mid.gain.setValueAtTime(0, startTime);
  chainIn.high.gain.setValueAtTime(0, startTime);

  // 中频先入（30% 处）
  chainIn.mid.gain.setTargetAtTime(v, startTime + duration * BAND_FADE_TIMING.mid.fadeInStart, tau);
  // 高频中入（50% 处）
  chainIn.high.gain.setTargetAtTime(v, startTime + duration * BAND_FADE_TIMING.high.fadeInStart, tau);
  // 低频最后入（80% 处，保留节奏感）
  chainIn.low.gain.setTargetAtTime(v, startTime + duration * BAND_FADE_TIMING.low.fadeInStart, tau);

  // 过渡结束后确保终值精确
  const endTime = startTime + duration + 0.1;
  chainOut.low.gain.setValueAtTime(0, endTime);
  chainOut.mid.gain.setValueAtTime(0, endTime);
  chainOut.high.gain.setValueAtTime(0, endTime);
  chainIn.low.gain.setValueAtTime(v, endTime);
  chainIn.mid.gain.setValueAtTime(v, endTime);
  chainIn.high.gain.setValueAtTime(v, endTime);
}
