/**
 * 汉字笔画数据查询
 *
 * 数据源：Make Me a Hanzi (makemeahanzi)
 * - 开源汉字笔画 SVG path 数据
 * - 每个字对应一组笔画 path（按书写顺序）
 *
 * 由于数据量大（~20000字），采用按需加载策略：
 * - 内置常用 3500 字的数据（精简版）
 * - 未命中时从远程加载（可选）
 *
 * 数据格式：
 * {
 *   "你": ["M 348 826 ...", "M 250 580 ...", ...],
 *   "好": ["M ...", ...],
 *   ...
 * }
 *
 * 来源：https://github.com/skishore/makemeahanzi
 * License: Arphic Public License
 */

// 笔画数据缓存
const strokeCache = new Map<string, string[]>();

// 已加载的字典
let dictionaryLoaded = false;
let dictionary: Record<string, string[]> = {};

/**
 * 加载内置字典（异步）
 * 字典文件为 JSON，按需 import
 */
export async function loadDictionary(): Promise<void> {
  if (dictionaryLoaded) return;

  try {
    // 动态导入字典文件（按需加载）
    // 字典文件放在 lib/hanziStrokes/dictionary.json
    const dictModule = await import('./hanziStrokes/dictionary.json');
    dictionary = dictModule.default || dictModule;
    dictionaryLoaded = true;
    console.log(`[hanziStrokes] 字典已加载，共 ${Object.keys(dictionary).length} 字`);
  } catch (err) {
    console.warn('[hanziStrokes] 字典加载失败，笔画渲染将降级为纯文字', err);
    dictionaryLoaded = true; // 标记已尝试，避免重复加载
  }
}

/**
 * 获取单个汉字的笔画 path 数组
 *
 * @param char 单个汉字
 * @returns SVG path 字符串数组，每个元素是一笔；未命中返回 null
 */
export function getStrokes(char: string): string[] | null {
  if (strokeCache.has(char)) {
    return strokeCache.get(char)!;
  }

  if (!dictionaryLoaded) {
    console.warn('[hanziStrokes] 字典未加载，请先调用 loadDictionary()');
    return null;
  }

  const strokes = dictionary[char];
  if (strokes && strokes.length > 0) {
    strokeCache.set(char, strokes);
    return strokes;
  }

  return null;
}

/**
 * 获取一段文字中所有汉字的笔画
 *
 * @param text 文字（可含非汉字字符）
 * @returns 每个字符的笔画数据，非汉字返回 null
 */
export function getTextStrokes(text: string): (string[] | null)[] {
  return Array.from(text).map((char) => {
    // 检测是否为 CJK 字符
    if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(char)) {
      return getStrokes(char);
    }
    return null;
  });
}

/**
 * 检查字典是否包含某字
 */
export function hasChar(char: string): boolean {
  return !!dictionary[char];
}

/**
 * 获取已加载字典的字数
 */
export function getDictionarySize(): number {
  return Object.keys(dictionary).length;
}
