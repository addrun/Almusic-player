/**
 * 色块引擎 (Color Block Engine)
 *
 * 负责色块的生成、位置计算、重叠检测
 *
 * 规则:
 * - 色块必须是长方形（不能是正方形）
 * - 窄边必须贴合屏幕四边之一
 * - 不能与歌词词组重合
 * - 与歌词保持最小安全距离
 * - 入场动画: 从窄边贴合的那条边滑入
 * - 出场动画: 入场动画的反转
 * - 乐队名/歌曲名色块: 根据文本长度动态计算尺寸
 */

import type { ColorBlock,WordLayout } from './layoutEngine';
import { GridLayout } from './layoutEngine';

/** 边缘方向 */
type Edge = 'top' | 'bottom' | 'left' | 'right';

/** 矩形区域 */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 检查两个矩形是否重叠（含安全距离）
 */
function rectsOverlap(a: Rect, b: Rect, margin = 0): boolean {
  return !(
    a.x + a.w + margin <= b.x ||
    b.x + b.w + margin <= a.x ||
    a.y + a.h + margin <= b.y ||
    b.y + b.h + margin <= a.y
  );
}

/**
 * 检查矩形是否与所有已占用区域不重叠
 */
function isRectFree(rect: Rect, occupied: Rect[], margin = 0): boolean {
  return !occupied.some((o) => rectsOverlap(rect, o, margin));
}

/**
 * 创建乐队名色块（竖排文字，贴合左边缘）
 *
 * 竖排文字 (writing-mode: vertical-rl):
 * - 宽度 = 一个字的宽度 ≈ fontSize × 1.3
 * - 高度 = 字符数 × 字间距 + padding
 * - x = 0 (贴合左边缘)
 * - 超长名称自动缩小字号和宽度
 */
export function createBandNameBlock(
  name: string,
  screenW: number,
  screenH: number,
  fontSize: number
): ColorBlock {
  const padding = fontSize * 0.6;
  const lineHeight = fontSize * 1.3;

  // 色块最大高度 = 屏幕高度的 70%
  const maxBlockHeight = screenH * 0.7;
  const naturalHeight = name.length * lineHeight + padding * 2;

  // 如果文字超出色块高度，缩小字号
  let actualFontSize = fontSize;
  if (naturalHeight > maxBlockHeight) {
    // 反算：maxBlockHeight = name.length * lineHeight + padding * 2
    const adjustedLineHeight = (maxBlockHeight - padding * 2) / name.length;
    actualFontSize = adjustedLineHeight / 1.3;
  }

  // 宽度根据实际字号计算（超长名称自动缩窄）
  const actualLineWidth = actualFontSize * 1.3;
  const blockWidth = Math.min(actualLineWidth + padding * 2, screenW * 0.25);

  // 高度取计算值和最大值的较小者
  const blockHeight = Math.min(naturalHeight, maxBlockHeight);

  return {
    id: 'band-name',
    x: 0, // 贴合左边缘
    y: screenH * 0.08,
    width: blockWidth,
    height: blockHeight,
    edge: 'left',
    isPermanent: true,
    text: name,
    fontSize: actualFontSize, // 实际渲染字号
    delay: 0,
  };
}

/**
 * 创建歌曲名色块（横排文字，贴合播放栏顶部）
 */
export function createSongTitleBlock(
  title: string,
  screenW: number,
  screenH: number,
  fontSize: number,
  playBarHeight = 80
): ColorBlock {
  const padding = fontSize * 0.5;
  let textWidth = 0;
  for (const char of title) {
    const isCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(char);
    textWidth += isCJK ? fontSize * 0.9 : fontSize * 0.55;
  }

  const blockWidth = Math.min(textWidth + padding * 2, screenW * 0.7);
  const blockHeight = fontSize * 2;

  return {
    id: 'song-title',
    x: screenW * 0.04,
    y: screenH - blockHeight - playBarHeight,
    width: blockWidth,
    height: blockHeight,
    edge: 'bottom',
    isPermanent: true,
    text: title,
    delay: 100,
  };
}

/**
 * 标记色块占用的网格区域
 */
function markBlockOccupied(grid: GridLayout, block: ColorBlock) {
  const col = Math.floor(block.x / grid.cellW);
  const row = Math.floor(block.y / grid.cellH);
  const w = Math.ceil(block.width / grid.cellW);
  const h = Math.ceil(block.height / grid.cellH);
  grid.occupyArea(col, row, w, h);
}

/**
 * 生成装饰色块
 *
 * @param grid 网格系统
 * @param wordLayouts 当前歌词布局（用于避让）
 * @param permanentBlocks 永久色块（用于避让）
 * @param count 生成数量
 * @param safetyMargin 安全距离（像素）
 */
export function generateColorBlocks(
  grid: GridLayout,
  wordLayouts: WordLayout[],
  permanentBlocks: ColorBlock[],
  count: number,
  safetyMargin = 25
): ColorBlock[] {
  const blocks: ColorBlock[] = [];

  // 收集所有已占用的矩形区域
  const occupiedRects: Rect[] = [];

  // 歌词占用区域（含安全距离）
  for (const word of wordLayouts) {
    occupiedRects.push({
      x: word.x - safetyMargin,
      y: word.y - safetyMargin,
      w: word.occupyCols * grid.cellW + safetyMargin * 2,
      h: word.occupyRows * grid.cellH + safetyMargin * 2,
    });
  }

  // 永久色块占用区域（含安全距离）
  for (const block of permanentBlocks) {
    occupiedRects.push({
      x: block.x - safetyMargin,
      y: block.y - safetyMargin,
      w: block.width + safetyMargin * 2,
      h: block.height + safetyMargin * 2,
    });
  }

  // 轮流尝试 4 个边缘，确保均匀分布
  const edges: Edge[] = ['top', 'bottom', 'left', 'right'];
  let attempts = 0;
  const maxAttempts = 400;

  while (blocks.length < count && attempts < maxAttempts) {
    attempts++;

    // 轮流使用边缘（而非完全随机）
    const edge = edges[blocks.length % edges.length];
    const block = tryGenerateBlock(grid, occupiedRects, edge, safetyMargin);
    if (block) {
      blocks.push(block);
      // 标记占用（含安全距离）
      occupiedRects.push({
        x: block.x - safetyMargin,
        y: block.y - safetyMargin,
        w: block.width + safetyMargin * 2,
        h: block.height + safetyMargin * 2,
      });
      markBlockOccupied(grid, block);
    }
  }

  return blocks;
}

/**
 * 尝试在指定边缘生成一个色块
 *
 * 关键：窄边必须紧贴屏幕边缘（坐标为 0 或屏幕尺寸）
 */
function tryGenerateBlock(
  grid: GridLayout,
  occupiedRects: Rect[],
  edge: Edge,
  safetyMargin: number
): ColorBlock | null {
  const screenW = grid.cols * grid.cellW;
  const screenH = grid.rows * grid.cellH;

  let w: number, h: number;
  let x: number, y: number;

  switch (edge) {
    case 'top': {
      // 水平色块: 宽 > 高，窄边(高度)紧贴顶部
      w = randInt(Math.floor(screenW * 0.08), Math.floor(screenW * 0.3));
      h = randInt(Math.floor(screenH * 0.04), Math.floor(screenH * 0.1));
      if (w <= h) w = h + randInt(30, 80);
      x = randInt(safetyMargin, Math.max(safetyMargin, screenW - w - safetyMargin));
      y = 0; // 紧贴顶部
      break;
    }
    case 'bottom': {
      // 水平色块: 宽 > 高，窄边(高度)紧贴底部
      w = randInt(Math.floor(screenW * 0.08), Math.floor(screenW * 0.3));
      h = randInt(Math.floor(screenH * 0.04), Math.floor(screenH * 0.1));
      if (w <= h) w = h + randInt(30, 80);
      x = randInt(safetyMargin, Math.max(safetyMargin, screenW - w - safetyMargin));
      y = screenH - h; // 紧贴底部
      break;
    }
    case 'left': {
      // 竖直色块: 高 > 宽，窄边(宽度)紧贴左侧
      w = randInt(Math.floor(screenW * 0.04), Math.floor(screenW * 0.1));
      h = randInt(Math.floor(screenH * 0.08), Math.floor(screenH * 0.3));
      if (h <= w) h = w + randInt(30, 80);
      x = 0; // 紧贴左侧
      y = randInt(safetyMargin, Math.max(safetyMargin, screenH - h - safetyMargin));
      break;
    }
    case 'right': {
      // 竖直色块: 高 > 宽，窄边(宽度)紧贴右侧
      w = randInt(Math.floor(screenW * 0.04), Math.floor(screenW * 0.1));
      h = randInt(Math.floor(screenH * 0.08), Math.floor(screenH * 0.3));
      if (h <= w) h = w + randInt(30, 80);
      x = screenW - w; // 紧贴右侧
      y = randInt(safetyMargin, Math.max(safetyMargin, screenH - h - safetyMargin));
      break;
    }
  }

  // 边界检查
  if (x + w > screenW || y + h > screenH) return null;
  if (x < 0 || y < 0) return null;

  // 检查是否与任何已占用区域重叠
  const newRect: Rect = { x, y, w, h };
  if (!isRectFree(newRect, occupiedRects, 0)) return null;

  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    x,
    y,
    width: w,
    height: h,
    edge,
    isPermanent: false,
    delay: Math.random() * 300,
  };
}

/**
 * 获取色块的滑入动画 CSS transform
 */
export function getSlideInTransform(edge: Edge): string {
  switch (edge) {
    case 'top':    return 'translateY(-120%)';
    case 'bottom': return 'translateY(120%)';
    case 'left':   return 'translateX(-120%)';
    case 'right':  return 'translateX(120%)';
  }
}

/**
 * 获取色块的滑出动画 CSS transform
 */
export function getSlideOutTransform(edge: Edge): string {
  return getSlideInTransform(edge);
}

/**
 * 获取渐变角度（沿滑入方向）
 */
export function getGradientAngle(edge: Edge): string {
  switch (edge) {
    case 'top':    return '180deg';
    case 'bottom': return '0deg';
    case 'left':   return '90deg';
    case 'right':  return '270deg';
  }
}

/** 工具函数: 随机整数 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
