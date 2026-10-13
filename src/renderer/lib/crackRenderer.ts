/**
 * 裂纹 Canvas 工具
 *
 * 递归分形裂纹算法，用于诡谲模式正片背景
 * 每次切歌词时重新绘制随机裂纹
 */

interface CrackSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

interface CrackOptions {
  /** 裂纹数量 */
  count?: number;
  /** 线宽范围 [min, max] */
  widthRange?: [number, number];
  /** 最大分叉深度 */
  maxDepth?: number;
  /** 分叉概率 0-1 */
  branchProbability?: number;
  /** 每段长度范围 [min, max] */
  segmentLength?: [number, number];
  /** 最大角度偏转（弧度） */
  maxAngleChange?: number;
  /** 裂纹颜色 */
  color?: string;
  /** 透明度 0-1 */
  opacity?: number;
}

const DEFAULT_OPTIONS: Required<CrackOptions> = {
  count: 8,
  widthRange: [0.5, 2],
  maxDepth: 5,
  branchProbability: 0.3,
  segmentLength: [30, 80],
  maxAngleChange: 0.5,
  color: '#ffffff',
  opacity: 0.15,
};

/**
 * 生成一条递归分形裂纹
 */
function generateCrack(
  startX: number,
  startY: number,
  angle: number,
  depth: number,
  options: Required<CrackOptions>,
  segments: CrackSegment[]
): void {
  if (depth <= 0) return;

  const length =
    options.segmentLength[0] +
    Math.random() * (options.segmentLength[1] - options.segmentLength[0]);
  const endX = startX + Math.cos(angle) * length;
  const endY = startY + Math.sin(angle) * length;
  const width =
    options.widthRange[0] +
    Math.random() * (options.widthRange[1] - options.widthRange[0]);

  segments.push({ x1: startX, y1: startY, x2: endX, y2: endY, width });

  // 递归分叉
  if (depth > 1 && Math.random() < options.branchProbability) {
    // 左分叉
    const leftAngle = angle - options.maxAngleChange * (0.5 + Math.random());
    generateCrack(endX, endY, leftAngle, depth - 1, options, segments);

    // 右分叉（概率减半）
    if (Math.random() < options.branchProbability * 0.5) {
      const rightAngle = angle + options.maxAngleChange * (0.5 + Math.random());
      generateCrack(endX, endY, rightAngle, depth - 1, options, segments);
    }
  }

  // 继续延伸
  if (depth > 1) {
    const newAngle = angle + (Math.random() - 0.5) * 2 * options.maxAngleChange;
    generateCrack(endX, endY, newAngle, depth - 1, options, segments);
  }
}

/**
 * 在指定 canvas 上绘制随机裂纹
 *
 * @param ctx Canvas 2D 上下文
 * @param width 画布宽度
 * @param height 画布高度
 * @param options 裂纹参数
 */
export function drawCracks(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options?: CrackOptions
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = opts.opacity;
  ctx.strokeStyle = opts.color;
  ctx.lineCap = 'round';

  for (let i = 0; i < opts.count; i++) {
    // 随机起点（从边缘或内部开始）
    const edge = Math.floor(Math.random() * 4);
    let startX: number, startY: number, angle: number;

    switch (edge) {
      case 0: // 上边
        startX = Math.random() * width;
        startY = 0;
        angle = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
        break;
      case 1: // 右边
        startX = width;
        startY = Math.random() * height;
        angle = Math.PI + (Math.random() - 0.5) * 0.8;
        break;
      case 2: // 下边
        startX = Math.random() * width;
        startY = height;
        angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
        break;
      default: // 左边
        startX = 0;
        startY = Math.random() * height;
        angle = 0 + (Math.random() - 0.5) * 0.8;
    }

    const segments: CrackSegment[] = [];
    generateCrack(startX, startY, angle, opts.maxDepth, opts, segments);

    // 绘制所有线段
    for (const seg of segments) {
      ctx.beginPath();
      ctx.lineWidth = seg.width;
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * 生成裂纹并返回 SVG path 字符串（可用于非 Canvas 场景）
 */
export function generateCrackPaths(
  width: number,
  height: number,
  options?: CrackOptions
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const paths: string[] = [];

  for (let i = 0; i < opts.count; i++) {
    const edge = Math.floor(Math.random() * 4);
    let startX: number, startY: number, angle: number;

    switch (edge) {
      case 0:
        startX = Math.random() * width;
        startY = 0;
        angle = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
        break;
      case 1:
        startX = width;
        startY = Math.random() * height;
        angle = Math.PI + (Math.random() - 0.5) * 0.8;
        break;
      case 2:
        startX = Math.random() * width;
        startY = height;
        angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
        break;
      default:
        startX = 0;
        startY = Math.random() * height;
        angle = (Math.random() - 0.5) * 0.8;
    }

    const segments: CrackSegment[] = [];
    generateCrack(startX, startY, angle, opts.maxDepth, opts, segments);

    for (const seg of segments) {
      paths.push(`M ${seg.x1} ${seg.y1} L ${seg.x2} ${seg.y2}`);
    }
  }

  return paths;
}
