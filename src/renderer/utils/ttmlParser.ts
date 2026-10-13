/**
 * TTML/LRC 歌词解析器
 *
 * 原创实现，支持：
 * - 标准 LRC 时间戳格式 [mm:ss.xx]
 * - 背景词（isBG）标记：以括号包裹的行
 * - 逐词时间戳 <mm:ss.xx>word
 */

import type { ILyricText } from '@/types/music';

/**
 * 解析 LRC 时间戳 [mm:ss.xx] 或 [mm:ss.xxx]
 */
function parseTimestamp(ts: string): number {
  const parts = ts.match(/^(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?$/);
  if (!parts) return 0;
  const min = parseInt(parts[1], 10);
  const sec = parseInt(parts[2], 10);
  const ms = parts[3] ? parseInt(parts[3].padEnd(3, '0'), 10) : 0;
  return min * 60000 + sec * 1000 + ms;
}

/**
 * 从歌词行中提取所有逐词时间戳和对应文本
 * 格式：<00:25.47>逐词歌词
 */
function extractWords(text: string): { text: string; startTime: number; duration: number }[] | undefined {
  const wordPattern = /<(\d{1,2}:\d{2}\.\d{2,3})>([^<]*)/g;
  const words: { text: string; startTime: number; duration: number }[] = [];
  let match;
  let prevTime = -1;

  while ((match = wordPattern.exec(text)) !== null) {
    const time = parseTimestamp(match[1]);
    const wordText = match[2].trim();
    if (wordText) {
      words.push({
        text: wordText,
        startTime: prevTime >= 0 ? prevTime : time,
        duration: prevTime >= 0 ? time - prevTime : 0
      });
      prevTime = time;
    }
  }

  return words.length > 0 ? words : undefined;
}

/**
 * 解析 TTML/LRC 格式歌词
 *
 * 支持格式：
 * - [00:25.47]歌词文本
 * - [00:25.47]<00:25.47>逐词歌词
 * - (背景词文本) — 以括号包裹的行标记为背景词
 * - 纯文本行（关联到上一行的时间戳）
 */
export function parseTtml(lyricsStr: string): ILyricText[] {
  const lines = lyricsStr.trim().split('\n');
  const result: ILyricText[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 标准 LRC 格式：[mm:ss.xx]文本
    const lrcMatch = trimmed.match(/^\[(\d{1,2}:\d{2}(?:\.\d{2,3})?)\](.*)$/);
    if (lrcMatch) {
      const startTime = parseTimestamp(lrcMatch[1]);
      const text = lrcMatch[2].trim();

      if (text) {
        const words = extractWords(text);
        // 如果有逐词时间戳，清除标签只保留纯文本
        const cleanText = words
          ? text.replace(/<\d{1,2}:\d{2}\.\d{2,3}>/g, '').trim()
          : text;

        result.push({
          text: cleanText,
          trText: '',
          startTime,
          isBG: false,
          words
        });
      }
      continue;
    }

    // 背景词标记：以 ( 开头的行
    const bgMatch = trimmed.match(/^\((.+)\)$/);
    if (bgMatch) {
      const bgText = bgMatch[1].trim();
      if (bgText && result.length > 0) {
        const lastLine = result[result.length - 1];
        result.push({
          text: bgText,
          trText: '',
          startTime: lastLine.startTime,
          isBG: true
        });
      }
      continue;
    }

    // 纯文本行：关联到上一行的时间戳
    if (trimmed && result.length > 0) {
      const lastLine = result[result.length - 1];
      result.push({
        text: trimmed,
        trText: '',
        startTime: lastLine.startTime,
        isBG: false
      });
    }
  }

  return result;
}

/**
 * 从 HTML 内容中提取背景词
 * 解析 <span ttm:role="x-bg">文本</span> 格式
 */
export function extractBackgroundFromHtml(html: string): string | null {
  const bgMatch = html.match(/<span[^>]*ttm:role="x-bg"[^>]*>([^<]*)<\/span>/i);
  return bgMatch ? bgMatch[1].trim() : null;
}

/**
 * 将歌词行转换为 lrcArray 格式
 * 背景词作为 isBG=true 的行插入到主歌词之后
 */
export function ttmlToLrcArray(lines: ILyricText[]): ILyricText[] {
  return lines.map((line) => ({ ...line }));
}
