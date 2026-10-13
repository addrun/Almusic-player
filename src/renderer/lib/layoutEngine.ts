/**
 * 排版引擎 (Layout Engine)
 *
 * 负责歌词分词（Intl.Segmenter）、重要性评分、网格位置分配
 */

/** 分词器（浏览器原生，支持中日韩） */
let segmenter: Intl.Segmenter | null = null;
function getSegmenter() {
  if (!segmenter) {
    segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
  }
  return segmenter;
}

/** 分词结果 */
export interface WordItem {
  text: string;
  importance: number; // 0~1，越高越重要
  fontSize: number;   // 最终字号 (px)
}

/** 网格位置 */
export interface GridCell {
  col: number;
  row: number;
}

/** 布局结果 */
export interface WordLayout {
  id: string;
  text: string;
  fontSize: number;
  col: number;
  row: number;
  x: number; // 像素坐标
  y: number;
  opacity: number;
  delay: number; // 入场动画延迟 (ms)
  /** 占用的网格区域 */
  occupyCols: number;
  occupyRows: number;
}

/** 色块 */
export interface ColorBlock {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  edge: 'top' | 'bottom' | 'left' | 'right';
  isPermanent: boolean;
  text?: string;
  fontSize?: number; // 自适应字号（乐队名/歌曲名）
  delay: number;
}

/**
 * 将歌词拆分为词组
 * 使用 Intl.Segmenter 进行中文分词（词级别，非字级别）
 * 英文按空格/标点拆分
 */
export function splitLyrics(text: string): string[] {
  if (!text) return [];

  try {
    const seg = getSegmenter();
    const segments = [...seg.segment(text)];
    return segments
      .filter((s) => s.isWordLike)
      .map((s) => s.segment)
      .filter((w) => w.trim().length > 0);
  } catch {
    // fallback: 中文按字拆分，英文按空格
    return text
      .split(/(?<=[\u4e00-\u9fff])|(?=[\u4e00-\u9fff])|\s+/)
      .filter(Boolean);
  }
}

/**
 * 为每个词计算重要性评分
 *
 * 规则:
 * - 长度 >= 2 字符 +0.2
 * - 长度 >= 4 字符 +0.3
 * - 全大写英文 +0.15
 * - 包含数字 +0.1
 * - 名词/动词 (jieba tag) +0.15
 */
export function scoreWords(words: string[]): number[] {
  return words.map((word, index) => {
    let score = 0.25; // 基础分

    // 首词加分
    if (index === 0) score += 0.2;

    // 长度加分
    if (word.length >= 2) score += 0.15;
    if (word.length >= 4) score += 0.2;

    // 全大写英文
    if (/^[A-Z]+$/.test(word)) score += 0.1;

    // 包含数字
    if (/\d/.test(word)) score += 0.1;

    // 独占一行（只有 1-2 个词时）
    if (words.length <= 2) score += 0.15;

    return Math.min(1, score);
  });
}

/**
 * 根据重要性计算字号
 *
 * @param importance 0~1
 * @param baseSize 基础字号
 * @param maxSize 最大字号
 */
export function calculateFontSize(importance: number, baseSize = 28, maxSize = 64): number {
  return Math.round(baseSize + (maxSize - baseSize) * importance);
}

/**
 * 网格系统
 *
 * 管理屏幕网格的占用状态，用于歌词和色块的布局避让
 */
export class GridLayout {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  occupied: Set<string>; // 已占用的格子 "col-row"

  constructor(screenW: number, screenH: number, cols = 12, rows = 8) {
    this.cols = cols;
    this.rows = rows;
    this.cellW = screenW / cols;
    this.cellH = screenH / rows;
    this.occupied = new Set();
  }

  /** 重置占用状态 */
  reset() {
    this.occupied.clear();
  }

  /** 标记格子为已占用 */
  occupy(col: number, row: number) {
    this.occupied.add(`${col}-${row}`);
  }

  /** 检查格子是否已占用 */
  isOccupied(col: number, row: number): boolean {
    return this.occupied.has(`${col}-${row}`);
  }

  /** 检查区域是否可用 (所有格子都未占用) */
  isAreaFree(col: number, row: number, w: number, h: number): boolean {
    for (let c = col; c < col + w; c++) {
      for (let r = row; r < row + h; r++) {
        if (c >= this.cols || r >= this.rows || c < 0 || r < 0) return false;
        if (this.isOccupied(c, r)) return false;
      }
    }
    return true;
  }

  /** 标记区域为已占用 */
  occupyArea(col: number, row: number, w: number, h: number) {
    for (let c = col; c < col + w; c++) {
      for (let r = row; r < row + h; r++) {
        this.occupy(c, r);
      }
    }
  }

  /** 格子坐标转像素坐标 */
  toPixel(col: number, row: number): { x: number; y: number } {
    return {
      x: col * this.cellW,
      y: row * this.cellH,
    };
  }

  /** 像素坐标转格子坐标 */
  toCell(x: number, y: number): GridCell {
    return {
      col: Math.floor(x / this.cellW),
      row: Math.floor(y / this.cellH),
    };
  }
}

/**
 * 为歌词词组分配网格位置
 *
 * 布局策略:
 * 1. 从网格中随机选择可用位置
 * 2. 重要词优先占据更大空间
 * 3. 避开边缘区域（留给色块）
 * 4. 确保词与词之间有间距，不重叠
 */
export function layoutWords(
  words: WordItem[],
  grid: GridLayout,
  edgeMargin = 2 // 边缘留出的格子数
): WordLayout[] {
  const layouts: WordLayout[] = [];

  // 收集可用位置（避开边缘）
  const availablePositions: GridCell[] = [];
  for (let col = edgeMargin; col < grid.cols - edgeMargin; col++) {
    for (let row = edgeMargin; row < grid.rows - edgeMargin; row++) {
      if (!grid.isOccupied(col, row)) {
        availablePositions.push({ col, row });
      }
    }
  }

  // 随机打乱可用位置
  shuffleArray(availablePositions);

  words.forEach((word, index) => {
    if (availablePositions.length === 0) return;

    // 计算该词需要占用的格子数（根据字号）
    const occupyCols = Math.max(1, Math.ceil(word.fontSize / grid.cellW));
    const occupyRows = Math.max(1, Math.ceil(word.fontSize / grid.cellH));

    // 找到一个能容纳该词且不与其他词重叠的位置
    let placed = false;
    for (let i = 0; i < availablePositions.length; i++) {
      const pos = availablePositions[i];
      if (grid.isAreaFree(pos.col, pos.row, occupyCols, occupyRows)) {
        // 额外检查：与已放置的词是否有像素级重叠（加安全边距）
        const pixel = grid.toPixel(pos.col, pos.row);
        const newRect = {
          x: pixel.x,
          y: pixel.y,
          w: occupyCols * grid.cellW,
          h: occupyRows * grid.cellH,
        };
        const overlaps = layouts.some((l) => {
          const existingRect = {
            x: l.x,
            y: l.y,
            w: l.occupyCols * grid.cellW,
            h: l.occupyRows * grid.cellH,
          };
          return rectsOverlap(newRect, existingRect, grid.cellW * 0.5);
        });
        if (overlaps) continue;

        // 标记占用
        grid.occupyArea(pos.col, pos.row, occupyCols, occupyRows);

        layouts.push({
          id: `word-${index}-${Date.now()}`,
          text: word.text,
          fontSize: word.fontSize,
          col: pos.col,
          row: pos.row,
          x: pixel.x,
          y: pixel.y,
          opacity: 1,
          delay: index * 100,
          occupyCols,
          occupyRows,
        });

        placed = true;
        break;
      }
    }

    // 如果没找到合适位置，跳过
    if (!placed) {
      console.warn(`[LayoutEngine] 无法为词 "${word.text}" 找到位置`);
    }
  });

  return layouts;
}

/**
 * 检查两个矩形是否重叠（含安全距离）
 */
function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  margin = 0
): boolean {
  return !(
    a.x + a.w + margin <= b.x ||
    b.x + b.w + margin <= a.x ||
    a.y + a.h + margin <= b.y ||
    b.y + b.h + margin <= a.y
  );
}

/**
 * Fisher-Yates 洗牌算法
 */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
