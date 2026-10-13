/**
 * beatAlign.ts — Level 2: BPM 节拍对齐过渡
 *
 * 根据 BPM 计算过渡窗口长度，将过渡起始点对齐到最近的乐句边界。
 *
 *   过渡窗口 = (60 / bpm) * 4  →  4 个拍
 *   乐句边界 = 每 16 个拍（4 小节 4/4）
 */

import { applyEqualPowerCrossfade } from './crossfade';

export interface BeatAlignOptions {
  bpm: number;
  beatOffset: number;     // 第一拍时间偏移（秒）
  currentTime: number;    // 当前播放时间（秒）
  remainingTime: number;  // 剩余播放时间（秒）
  ctx: AudioContext;
  gainOut: GainNode;
  gainIn: GainNode;
  defaultDuration: number; // 默认过渡时长（秒），降级时使用
  volumeScale?: number;    // 音量缩放，透传给 applyEqualPowerCrossfade
}

export interface BeatAlignResult {
  startTime: number;      // 过渡开始时间（AudioContext.currentTime）
  duration: number;       // 过渡时长
  reason: string;         // 说明
  level: 1 | 2;            // 实际使用的等级（可能降级为 1）
}

/**
 * 计算节拍对齐的过渡参数
 */
export function calculateBeatAlignedTransition(opts: BeatAlignOptions): BeatAlignResult {
  const { bpm, beatOffset, currentTime, remainingTime, ctx, defaultDuration } = opts;
  const volumeScale = opts.volumeScale ?? 1;

  // 检查 BPM 有效性
  if (!bpm || bpm < 50 || bpm > 250) {
    // 降级为 Level 1 等功率
    const startTime = ctx.currentTime;
    applyEqualPowerCrossfade(ctx, opts.gainOut, opts.gainIn, startTime, defaultDuration, volumeScale);
    return {
      startTime,
      duration: defaultDuration,
      reason: 'BPM 无效，降级为等功率过渡',
      level: 1
    };
  }

  const beatDuration = 60 / bpm;                    // 单拍时长（秒）
  const transitionWindow = beatDuration * 4;         // 4 拍过渡窗口

  // 检查剩余时间是否足够
  if (remainingTime < transitionWindow) {
    // 剩余时间不足，降级为 Level 1（缩短时长）
    const duration = Math.max(2, remainingTime * 0.8);
    const startTime = ctx.currentTime;
    applyEqualPowerCrossfade(ctx, opts.gainOut, opts.gainIn, startTime, duration, volumeScale);
    return {
      startTime,
      duration,
      reason: `剩余时间不足 4 拍（${remainingTime.toFixed(1)}s < ${transitionWindow.toFixed(1)}s），降级为等功率`,
      level: 1
    };
  }

  // 计算乐句边界（每 16 拍 = 4 小节 4/4）
  const phraseBeats = 16;
  const phraseDuration = beatDuration * phraseBeats;

  // 当前时间相对于第一拍的位置（拍数）
  const elapsedBeats = Math.floor((currentTime - beatOffset) / beatDuration);
  const currentPhrase = Math.floor(elapsedBeats / phraseBeats);

  // 下一个乐句边界的绝对时间
  const nextPhraseTime = beatOffset + (currentPhrase + 1) * phraseDuration;

  // 距离下一个乐句边界还有多久
  const timeToPhrase = nextPhraseTime - currentTime;

  let startTime: number;
  let duration: number;
  let reason: string;

  if (timeToPhrase > 0 && timeToPhrase < phraseDuration * 0.5) {
    // 距离乐句边界较近（半个乐句内），对齐到乐句边界
    startTime = ctx.currentTime + timeToPhrase;
    duration = transitionWindow;
    reason = `BPM=${bpm}，对齐到乐句边界（${timeToPhrase.toFixed(1)}s 后），过渡 ${duration.toFixed(1)}s（4 拍）`;
  } else {
    // 距离乐句边界较远，在剩余时间前 4 拍处开始
    const transitionStartOffset = remainingTime - transitionWindow;
    startTime = ctx.currentTime + transitionStartOffset;
    duration = transitionWindow;
    reason = `BPM=${bpm}，歌曲结束前 ${duration.toFixed(1)}s 开始过渡（4 拍）`;
  }

  // 应用等功率 crossfade
  applyEqualPowerCrossfade(ctx, opts.gainOut, opts.gainIn, startTime, duration, volumeScale);

  return { startTime, duration, reason, level: 2 };
}

/**
 * 调度预加载：在歌曲结束前 N 秒预加载下一首
 * @returns 预加载时间点（AudioContext.currentTime 偏移）
 */
export function calculatePreloadTime(
  remainingTime: number,
  transitionDuration: number
): number {
  // 在过渡开始前 2 秒预加载，确保 AudioBuffer 解码完成
  return Math.max(0, remainingTime - transitionDuration - 2);
}
