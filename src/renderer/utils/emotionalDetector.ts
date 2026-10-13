/**
 * 情感词检测器 (Emotional Detector)
 *
 * 双逻辑检测：
 * 1. 内置情感词典 + 用户自定义词典
 * 2. jieba 高频词分析 → 临时字典 → 跨歌曲计数 → 长效字典
 */

import { splitLyrics, splitLyricsWithTags, isVerbOrNoun } from './wordSplitter';

/** 内置情感词典 */
const DEFAULT_EMOTIONAL_WORDS = new Set([
  // 负面情绪
  '病', '痛', '死', '伤', '泪', '哭', '碎', '裂', '恨', '怒', '疯', '狂', '悲', '苦', '毒', '血',
  // 正面情绪
  '爱', '恋', '想', '梦', '光', '火', '燃', '飞', '醉',
  // 程度词
  '最', '太', '极', '超', '绝', '万', '千', '百',
  // 动作词
  '杀', '砍', '撕', '打', '砸', '摔', '撞', '炸',
]);

/** 高频词最低出现次数（单首歌曲内） */
const HIGH_FREQ_THRESHOLD = 3;
/** 跨歌曲升级到长效字典的阈值 */
const LONG_TERM_THRESHOLD = 5;

/** localStorage 键名 */
const STORAGE_KEY_FREQ = 'frenzy-freq-words';
const STORAGE_KEY_SONG_COUNT = 'frenzy-song-counts';

/** 临时高频词典（当前会话） */
const tempDict = new Set<string>();

/** 长效词典（持久化） */
let longTermDict = new Set<string>();

/** 跨歌曲词频统计 { word → Set<songId> } */
let songWordCounts = new Map<string, Set<string>>();

/** 当前歌曲 ID */
let currentSongId = '';

// ─── 持久化 ───

function loadLongTermDict(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FREQ);
    if (saved) longTermDict = new Set(JSON.parse(saved));
  } catch { /* ignore */ }
}

function saveLongTermDict(): void {
  try {
    localStorage.setItem(STORAGE_KEY_FREQ, JSON.stringify([...longTermDict]));
  } catch { /* ignore */ }
}

function loadSongWordCounts(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SONG_COUNT);
    if (saved) {
      const obj = JSON.parse(saved) as Record<string, string[]>;
      songWordCounts = new Map(Object.entries(obj).map(([k, v]) => [k, new Set(v)]));
    }
  } catch { /* ignore */ }
}

function saveSongWordCounts(): void {
  try {
    const obj: Record<string, string[]> = {};
    for (const [k, v] of songWordCounts) obj[k] = [...v];
    localStorage.setItem(STORAGE_KEY_SONG_COUNT, JSON.stringify(obj));
  } catch { /* ignore */ }
}

// 初始化加载
loadLongTermDict();
loadSongWordCounts();

// ─── 核心逻辑 ───

/**
 * 设置当前歌曲 ID（切换歌曲时调用）
 */
export function setCurrentSongId(songId: string): void {
  currentSongId = songId;
}

/**
 * 分析一首完整歌词的高频词，更新临时字典和跨歌曲计数
 * 在歌曲播放开始或歌词加载时调用
 */
export function analyzeLyricsForHighFreqWords(lyrics: Array<{ text: string }>): void {
  if (!lyrics || lyrics.length === 0) return;

  // 合并所有歌词文本
  const fullText = lyrics.map((l) => l.text).join(' ');
  if (!fullText.trim()) return;

  // jieba 分词
  const words = splitLyrics(fullText);
  if (words.length === 0) return;

  // 统计词频（过滤单字和标点）
  const freq = new Map<string, number>();
  for (const w of words) {
    const word = w.trim();
    if (word.length < 2 || /[\u3000-\u303f\uff00-\uffef]/.test(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // 高频词加入临时字典
  tempDict.clear();
  for (const [word, count] of freq) {
    if (count >= HIGH_FREQ_THRESHOLD) {
      tempDict.add(word);
    }
  }

  // 跨歌曲计数：只统计临时字典中的词
  if (currentSongId) {
    for (const word of tempDict) {
      if (!songWordCounts.has(word)) {
        songWordCounts.set(word, new Set());
      }
      songWordCounts.get(word)!.add(currentSongId);

      // 达到阈值 → 升级到长效字典
      if (songWordCounts.get(word)!.size >= LONG_TERM_THRESHOLD) {
        if (!longTermDict.has(word)) {
          longTermDict.add(word);
          saveLongTermDict();
        }
      }
    }
    saveSongWordCounts();
  }
}

/**
 * 获取完整情感词集（内置 + 用户自定义 + 长效字典）
 */
function getFullDict(customDict?: string[]): Set<string> {
  const result = new Set<string>(DEFAULT_EMOTIONAL_WORDS);
  for (const w of longTermDict) result.add(w);
  if (customDict) {
    for (const w of customDict) result.add(w);
  }
  return result;
}

/** 检测结果 */
export interface EmotionalDetectionResult {
  /** 原始完整歌词 */
  fullText: string;
  /** 去除情感词后的句子 */
  blackText: string;
  /** 情感词数组 */
  redWords: string[];
}

/**
 * 检测歌词中的情感词（双逻辑合并）
 *
 * 优先级：词 > 字，临时字典 > 长效字典 > 内置字典
 * 每句必须有一个标红词
 *
 * @param text - 歌词文本
 * @param customDict - 用户自定义情感词典（可选）
 * @returns 检测结果
 */
export function detectEmotionalWords(
  text: string,
  customDict?: string[]
): EmotionalDetectionResult {
  if (!text) {
    return { fullText: '', blackText: '', redWords: [] };
  }

  // 在文本中搜索指定词集，返回最早出现的词
  function findFirst(words: Iterable<string>, minLen = 1): { word: string; index: number } | null {
    let best: { word: string; index: number } | null = null;
    for (const w of words) {
      if (w.length < minLen) continue;
      const idx = text.indexOf(w);
      if (idx === -1) continue;
      if (!best || idx < best.index || (idx === best.index && w.length > best.word.length)) {
        best = { word: w, index: idx };
      }
    }
    return best;
  }

  // 检查词是否包含内置字典中的单字
  const builtInSingleChars = new Set<string>();
  for (const w of DEFAULT_EMOTIONAL_WORDS) { if (w.length === 1) builtInSingleChars.add(w); }

  function containsBuiltInChar(word: string): boolean {
    for (const ch of builtInSingleChars) {
      if (word.includes(ch)) return true;
    }
    return false;
  }

  let hit: { word: string; index: number } | null = null;

  // 优先级1：临时字典多字词（含内置单字的优先）
  const tempMultiWithBuiltIn = new Set<string>();
  const tempMultiOther = new Set<string>();
  for (const w of tempDict) {
    if (w.length < 2) continue;
    if (containsBuiltInChar(w)) tempMultiWithBuiltIn.add(w);
    else tempMultiOther.add(w);
  }
  hit = findFirst(tempMultiWithBuiltIn, 2);
  if (!hit) hit = findFirst(tempMultiOther, 2);

  // 优先级2：内置字典（全部）
  if (!hit) hit = findFirst(DEFAULT_EMOTIONAL_WORDS);

  // 优先级3：长效字典多字词
  if (!hit) {
    const longTermMulti = new Set<string>();
    for (const w of longTermDict) { if (w.length >= 2) longTermMulti.add(w); }
    hit = findFirst(longTermMulti, 2);
  }

  // 优先级4：临时字典单字
  if (!hit) {
    const tempSingle = new Set<string>();
    for (const w of tempDict) { if (w.length === 1) tempSingle.add(w); }
    hit = findFirst(tempSingle);
  }

  // 优先级5：长效字典单字
  if (!hit) {
    const longTermSingle = new Set<string>();
    for (const w of longTermDict) { if (w.length === 1) longTermSingle.add(w); }
    hit = findFirst(longTermSingle);
  }

  // 优先级6：兜底 jieba 分词
  if (!hit) {
    const words = splitLyrics(text);
    if (words.length > 0) {
      hit = { word: words[0], index: text.indexOf(words[0]) };
    }
  }

  const redWords: string[] = [];
  let blackText = text;
  if (hit) {
    redWords.push(hit.word);
    blackText = text.replace(hit.word, '');
  }

  return { fullText: text, blackText, redWords };
}

/**
 * 获取歌词中所有情感词候选（按优先级排序）
 *
 * 与 detectEmotionalWords 不同，本函数返回全部候选词而非仅第一个命中。
 * 用于高潮阶段每句歌词选择不同的词汇，避免重复。
 *
 * 优先级与 detectEmotionalWords 一致：
 * 1. 临时字典多字词（含内置单字的优先）
 * 2. 临时字典多字词（其他）
 * 3. 内置字典
 * 4. 长效字典多字词
 * 5. 临时字典单字
 * 6. 长效字典单字
 * 7. 兜底 jieba 分词
 *
 * @param text - 歌词文本
 * @param customDict - 用户自定义情感词典（可选）
 * @returns 按优先级排序的候选词数组（已去重）
 */
export function getEmotionalWordCandidates(
  text: string,
  customDict?: string[]
): string[] {
  if (!text) return [];

  const candidates: string[] = [];
  const seen = new Set<string>();

  /** 收集词集中所有在文本中出现的词，按出现位置排序后加入候选 */
  function addCandidates(words: Iterable<string>, minLen = 1): void {
    const found: Array<{ word: string; index: number }> = [];
    for (const w of words) {
      if (w.length < minLen) continue;
      const idx = text.indexOf(w);
      if (idx === -1 || seen.has(w)) continue;
      found.push({ word: w, index: idx });
      seen.add(w);
    }
    // 同一优先级内按出现位置排序，相同位置取更长的词
    found.sort((a, b) => a.index - b.index || b.word.length - a.word.length);
    for (const f of found) candidates.push(f.word);
  }

  // 检查词是否包含内置字典中的单字
  const builtInSingleChars = new Set<string>();
  for (const w of DEFAULT_EMOTIONAL_WORDS) {
    if (w.length === 1) builtInSingleChars.add(w);
  }

  function containsBuiltInChar(word: string): boolean {
    for (const ch of builtInSingleChars) {
      if (word.includes(ch)) return true;
    }
    return false;
  }

  // 优先级1：临时字典多字词（含内置单字的优先）
  const tempMultiWithBuiltIn = new Set<string>();
  const tempMultiOther = new Set<string>();
  for (const w of tempDict) {
    if (w.length < 2) continue;
    if (containsBuiltInChar(w)) tempMultiWithBuiltIn.add(w);
    else tempMultiOther.add(w);
  }
  addCandidates(tempMultiWithBuiltIn, 2);
  addCandidates(tempMultiOther, 2);

  // 优先级2：内置字典（全部）
  addCandidates(DEFAULT_EMOTIONAL_WORDS);

  // 优先级3：长效字典多字词
  const longTermMulti = new Set<string>();
  for (const w of longTermDict) {
    if (w.length >= 2) longTermMulti.add(w);
  }
  addCandidates(longTermMulti, 2);

  // 优先级4：临时字典单字
  const tempSingle = new Set<string>();
  for (const w of tempDict) {
    if (w.length === 1) tempSingle.add(w);
  }
  addCandidates(tempSingle);

  // 优先级5：长效字典单字
  const longTermSingle = new Set<string>();
  for (const w of longTermDict) {
    if (w.length === 1) longTermSingle.add(w);
  }
  addCandidates(longTermSingle);

  // 优先级6：兜底 jieba 分词（仅当前面无候选时）
  if (candidates.length === 0) {
    const words = splitLyrics(text);
    for (const w of words) {
      if (!seen.has(w)) {
        candidates.push(w);
        seen.add(w);
      }
    }
  }

  return candidates;
}

/**
 * 获取高潮阶段的重点词候选（优先两字以上的动词/名词）
 *
 * 专为诡谲模式高潮阶段设计，使用 jieba 词性标注：
 * 1. 两字以上的动词/名词（按出现位置排序）
 * 2. 情感词典命中的多字词
 * 3. 两字以上的其他词（形容词、副词等）
 * 4. 情感词典命中的单字
 * 5. 兜底 jieba 全部分词
 *
 * @param text - 歌词文本
 * @param customDict - 用户自定义情感词典（可选）
 * @returns 按优先级排序的候选词数组（已去重）
 */
export function getClimaxWordCandidates(
  text: string,
  customDict?: string[]
): string[] {
  if (!text) return [];

  const candidates: string[] = [];
  const seen = new Set<string>();

  function addUnique(word: string): void {
    const w = word.trim();
    if (w && !seen.has(w)) {
      seen.add(w);
      candidates.push(w);
    }
  }

  /** 过滤标点和空白 */
  function isMeaningful(word: string): boolean {
    return word.length > 0 && !/[\u3000-\u303f\uff00-\uffef\s]/.test(word);
  }

  // jieba 带词性分词
  const tagged = splitLyricsWithTags(text);

  // 优先级 1：两字以上的动词/名词
  for (const { word, tag } of tagged) {
    if (word.length >= 2 && isMeaningful(word) && isVerbOrNoun(tag)) {
      addUnique(word);
    }
  }

  // 优先级 2：情感词典命中的多字词（复用现有优先级逻辑）
  const emotionalCandidates = getEmotionalWordCandidates(text, customDict);
  for (const w of emotionalCandidates) {
    if (w.length >= 2) addUnique(w);
  }

  // 优先级 3：两字以上的其他词（形容词、副词等）
  for (const { word } of tagged) {
    if (word.length >= 2 && isMeaningful(word)) {
      addUnique(word);
    }
  }

  // 优先级 4：情感词典命中的单字
  for (const w of emotionalCandidates) {
    if (w.length < 2) addUnique(w);
  }

  // 优先级 5：兜底 jieba 全部分词（含单字）
  if (candidates.length === 0) {
    for (const { word } of tagged) {
      if (isMeaningful(word)) addUnique(word);
    }
  }

  return candidates;
}

/**
 * 批量检测多行歌词
 */
export function detectEmotionalWordsBatch(
  lyrics: Array<{ text: string }>,
  customDict?: string[]
): EmotionalDetectionResult[] {
  return lyrics.map((line) => detectEmotionalWords(line.text, customDict));
}

/**
 * 获取情感词在原文中的位置
 */
export function getEmotionalWordPositions(
  text: string,
  emotionalWords: string[]
): Array<{ word: string; index: number; length: number }> {
  const positions: Array<{ word: string; index: number; length: number }> = [];

  for (const word of emotionalWords) {
    let startIndex = 0;
    let index: number;

    while ((index = text.indexOf(word, startIndex)) !== -1) {
      positions.push({ word, index, length: word.length });
      startIndex = index + word.length;
    }
  }

  positions.sort((a, b) => a.index - b.index);
  return positions;
}

/**
 * 获取长效字典（供 UI 展示）
 */
export function getLongTermDict(): string[] {
  return [...longTermDict];
}

/**
 * 获取当前临时高频词典（供 UI 展示）
 */
export function getTempDict(): string[] {
  return [...tempDict];
}
