/**
 * crossfade.ts — Level 1: 等功率淡入淡出 (Equal-power Crossfade)
 *
 * 使用余弦曲线控制音量，确保过渡段总功率恒定，避免音量凹陷。
 *
 *   淡出: gain(t) = cos(π·t / 2)    ← 从 1 → 0
 *   淡入: gain(t) = sin(π·t / 2)    ← 从 0 → 1
 *   两者平方和 = cos² + sin² = 1（功率守恒）
 *
 * 使用 setValueCurveAtTime 写入 Float32Array 曲线，精度高、无抖动。
 */

/**
 * 生成等功率淡入或淡出曲线
 * @param samples 采样点数
 * @param direction 'in' 淡入 | 'out' 淡出
 * @returns Float32Array 曲线
 */
export function equalPowerCurve(
  samples: number,
  direction: 'in' | 'out'
): Float32Array {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const angle = (Math.PI * t) / 2;
    if (direction === 'in') {
      curve[i] = Math.sin(angle);
    } else {
      curve[i] = Math.cos(angle);
    }
  }
  return curve;
}

/**
 * 对两个 GainNode 应用等功率交叉淡入淡出
 *
 * @param ctx AudioContext
 * @param gainOut 淡出的 GainNode（当前歌曲）
 * @param gainIn 淡入的 GainNode（下一首歌）
 * @param startTime 开始时间（AudioContext.currentTime）
 * @param duration 过渡时长（秒）
 * @param volumeScale 音量缩放（0~1），曲线终值/起始值会乘以该系数，
 *                    用于与全局音量保持一致，避免过渡段音量跳变
 */
export function applyEqualPowerCrossfade(
  ctx: AudioContext,
  gainOut: GainNode,
  gainIn: GainNode,
  startTime: number,
  duration: number,
  volumeScale: number = 1
): void {
  const samples = Math.max(64, Math.ceil(duration * 100));
  const scale = Math.max(0, Math.min(1, volumeScale));

  const curveOut = new Float32Array(samples);
  const curveIn = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const angle = (Math.PI * t) / 2;
    curveOut[i] = Math.cos(angle) * scale;
    curveIn[i] = Math.sin(angle) * scale;
  }

  // 确保起始值正确
  gainOut.gain.setValueAtTime(scale, startTime);
  gainIn.gain.setValueAtTime(0, startTime);

  // 应用曲线
  gainOut.gain.setValueCurveAtTime(curveOut, startTime, duration);
  gainIn.gain.setValueCurveAtTime(curveIn, startTime, duration);

  // 过渡结束后确保终值精确
  gainOut.gain.setValueAtTime(0, startTime + duration + 0.001);
  gainIn.gain.setValueAtTime(scale, startTime + duration + 0.001);
}

/**
 * 线性淡入淡出（简单备选，不等功率）
 * 总功率在中间会有凹陷（~3dB），但实现最简单
 */
export function applyLinearCrossfade(
  ctx: AudioContext,
  gainOut: GainNode,
  gainIn: GainNode,
  startTime: number,
  duration: number
): void {
  gainOut.gain.setValueAtTime(1, startTime);
  gainIn.gain.setValueAtTime(0, startTime);

  gainOut.gain.linearRampToValueAtTime(0, startTime + duration);
  gainIn.gain.linearRampToValueAtTime(1, startTime + duration);
}
