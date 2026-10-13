/**
 * bpmAnalyzer.worker.ts — Web Worker: 离线 BPM 自相关分析
 *
 * 在 Worker 线程中解码音频并使用自相关算法计算精确 BPM，
 * 避免阻塞主线程 UI。
 *
 * 算法:
 *   1. 使用 OfflineAudioContext 解码 ArrayBuffer → PCM 数据
 *   2. 降采样到 ~8kHz（减少计算量，足够检测低频鼓点）
 *   3. 计算能量包络：窗口 RMS
 *   4. 自相关：对 lag 范围 0.3s~1.0s（对应 60~200 BPM）
 *   5. 取自相关峰值对应的 lag → BPM = 60 / lag
 *   6. 倍频校正：检查 2x / 0.5x 是否更强
 *
 * 通信协议:
 *   主线程 postMessage({ type: 'analyze', arrayBuffer, sampleRate })
 *   Worker → postMessage({ type: 'result', bpm, confidence, beatOffset })
 */

interface AnalyzeMessage {
  type: 'analyze';
  arrayBuffer: ArrayBuffer;
}

interface BpmResult {
  type: 'result';
  bpm: number;
  confidence: number;   // 0~1
  beatOffset: number;  // 第一拍的时间偏移（秒）
}

const MIN_BPM = 60;
const MAX_BPM = 200;
const DOWNSAMPLE_RATE = 8000;
const FRAME_SIZE = 1024;
const HOP_SIZE = 512;

self.onmessage = async (e: MessageEvent<AnalyzeMessage>) => {
  const { type, arrayBuffer } = e.data;
  if (type !== 'analyze') return;

  try {
    // 使用 OfflineAudioContext 解码音频
    const tempCtx = new OfflineAudioContext(1, 1, DOWNSAMPLE_RATE);
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);

    // 取第一个声道，降采样
    const originalData = audioBuffer.getChannelData(0);
    const originalRate = audioBuffer.sampleRate;
    const downsampled = downsample(originalData, originalRate, DOWNSAMPLE_RATE);

    // 计算能量包络（RMS）
    const energy = computeEnergyEnvelope(downsampled, FRAME_SIZE, HOP_SIZE);

    // 自相关分析
    const { bpm, confidence, beatOffset } = autocorrelateBPM(energy, HOP_SIZE, DOWNSAMPLE_RATE);

    const result: BpmResult = { type: 'result', bpm, confidence, beatOffset };
    (self as any).postMessage(result);
  } catch (err) {
    (self as any).postMessage({
      type: 'error',
      error: err instanceof Error ? err.message : String(err)
    });
  }
};

/** 降采样 */
function downsample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return data;
  const ratio = fromRate / toRate;
  const newLength = Math.floor(data.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0;
    for (let j = start; j < end && j < data.length; j++) {
      sum += data[j];
    }
    result[i] = sum / (end - start);
  }
  return result;
}

/** 计算能量包络（RMS） */
function computeEnergyEnvelope(
  data: Float32Array,
  frameSize: number,
  hopSize: number
): Float32Array {
  const numFrames = Math.floor((data.length - frameSize) / hopSize) + 1;
  const energy = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let sum = 0;
    for (let j = 0; j < frameSize; j++) {
      const s = data[start + j];
      sum += s * s;
    }
    energy[i] = Math.sqrt(sum / frameSize);
  }
  return energy;
}

/** 自相关法检测 BPM */
function autocorrelateBPM(
  energy: Float32Array,
  hopSize: number,
  sampleRate: number
): { bpm: number; confidence: number; beatOffset: number } {
  const hopDuration = hopSize / sampleRate;  // 每帧时间间隔（秒）
  const minLag = Math.round(MIN_BPM / 60 / hopDuration);   // 最小 lag（对应最大间隔 = 最低 BPM）
  const maxLag = Math.round(MAX_BPM / 60 / hopDuration);   // 最大 lag（对应最小间隔 = 最高 BPM）

  // 注意：lag 越大 → 间隔越大 → BPM 越低
  // 所以 minLag 对应 MAX_BPM，maxLag 对应 MIN_BPM
  const lowLag = Math.round((60 / MAX_BPM) / hopDuration);
  const highLag = Math.round((60 / MIN_BPM) / hopDuration);

  let bestLag = 0;
  let bestScore = 0;
  let sumScore = 0;

  // 计算自相关
  const scores = new Float32Array(highLag + 1);
  for (let lag = lowLag; lag <= highLag; lag++) {
    let correlation = 0;
    for (let i = 0; i < energy.length - lag; i++) {
      correlation += energy[i] * energy[i + lag];
    }
    scores[lag] = correlation;
    sumScore += correlation;
    if (correlation > bestScore) {
      bestScore = correlation;
      bestLag = lag;
    }
  }

  if (bestLag === 0 || sumScore === 0) {
    return { bpm: 120, confidence: 0, beatOffset: 0 };  // 默认值
  }

  // 倍频校正
  const halfLag = Math.round(bestLag / 2);
  if (halfLag >= lowLag && scores[halfLag] > bestScore * 0.85) {
    bestLag = halfLag;
    bestScore = scores[halfLag];
  }

  const doubleLag = bestLag * 2;
  if (doubleLag <= highLag && scores[doubleLag] > bestScore * 1.1) {
    bestLag = doubleLag;
    bestScore = scores[doubleLag];
  }

  const bpm = Math.round(60 / (bestLag * hopDuration));
  const confidence = Math.min(1, bestScore / (sumScore / (highLag - lowLag + 1)));

  // 估算第一拍偏移：找能量包络的第一个峰值
  const beatOffset = findFirstBeat(energy, hopSize, sampleRate, bestLag);

  return { bpm, confidence, beatOffset };
}

/** 找第一拍位置 */
function findFirstBeat(
  energy: Float32Array,
  hopSize: number,
  sampleRate: number,
  beatLag: number
): number {
  // 找能量包络的第一个显著峰值
  const threshold = 0.3 * Math.max(...energy);
  for (let i = 1; i < energy.length - 1; i++) {
    if (energy[i] > threshold && energy[i] > energy[i - 1] && energy[i] > energy[i + 1]) {
      return (i * hopSize) / sampleRate;
    }
  }
  return 0;
}

export {};
