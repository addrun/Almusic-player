<template>
  <svg
    :viewBox="`0 0 ${viewBoxSize} ${viewBoxSize}`"
    class="neon-stroke-svg"
    :style="{
      '--neon-color': color,
      '--neon-color-bright': brightColor,
      '--beat-scale': beatScale,
      '--beat-spike': beatSpike,
    }"
  >
    <defs>
      <!-- 老旧褪色 filter：轻微模糊 + 微弱发光 -->
      <filter :id="filterId" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" :stdDeviation="1.5 + beatSpike * 2" result="blur1" />
        <feMerge>
          <feMergeNode in="blur1" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <!-- 背景模糊层 filter -->
      <filter :id="bgFilterId" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" :stdDeviation="4 + beatSpike * 3" />
      </filter>
      <!-- 笔画断开 mask：仅对有重叠的笔画生成（n-1 个笔画在重叠处断为两节） -->
      <mask
        v-for="stroke in maskStrokes"
        :key="'mask-' + stroke.index"
        :id="`${uid}-mask-${stroke.index}`"
        maskUnits="userSpaceOnUse"
      >
        <rect x="0" y="0" :width="viewBoxSize" :height="viewBoxSize" fill="white" />
        <rect
          v-for="(rect, ri) in stroke.maskRects"
          :key="ri"
          :x="rect.x"
          :y="viewBoxSize - rect.y - rect.height"
          :width="rect.width"
          :height="rect.height"
          fill="black"
        />
      </mask>
    </defs>

    <!-- 背景模糊层（笔画在背景上的投影） -->
    <g
      :filter="`url(#${bgFilterId})`"
      :opacity="0.15 + beatSpike * 0.15"
      class="neon-bg-glow"
      :transform="`matrix(1, 0, 0, -1, 0, ${viewBoxSize})`"
    >
      <path
        v-for="stroke in processedStrokes"
        :key="'bg-' + stroke.index"
        :d="stroke.path"
        :fill="color"
        :opacity="0.3"
        :mask="stroke.maskRects.length > 0 ? `url(#${uid}-mask-${stroke.index})` : undefined"
      />
    </g>

    <!-- 陈旧笔画层 -->
    <g
      :filter="`url(#${filterId})`"
      :opacity="0.7 + beatSpike * 0.15"
      class="neon-tube"
      :transform="`matrix(1, 0, 0, -1, 0, ${viewBoxSize})`"
    >
      <path
        v-for="stroke in processedStrokes"
        :key="'tube-' + stroke.index"
        :d="stroke.path"
        :fill="brightColor"
        :stroke="color"
        :stroke-width="1"
        :mask="stroke.maskRects.length > 0 ? `url(#${uid}-mask-${stroke.index})` : undefined"
        class="neon-stroke-path"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
/**
 * NeonStrokeChar — 单个汉字的陈旧笔画渲染
 *
 * 将汉字笔画用 SVG path 渲染为褪色老旧效果：
 * - 每个笔画填充暗色 + 描边强调色
 * - 轻微模糊产生褪色感
 * - 背景层投射模糊阴影
 * - 重叠笔画：n 个笔画重叠时，后 n-1 个在重叠处断为两节（mask 遮挡中间条带）
 * - 鼓点命中时：亮度微升 + CSS 微缩放
 */
import { computed, onMounted, ref, watch } from 'vue';

import { useStyleEngineStore } from '@/store/modules/styleEngine';
import { getStrokes, loadDictionary } from '@/lib/hanziStrokes';

const props = defineProps<{
  char: string;
  /** 尺寸（px） */
  size?: number;
  /** 强调色 */
  color?: string;
  /** 鼓点峰值 0-1（由父组件传入，持续 ~120ms） */
  beatSpike?: number;
}>();

const styleEngine = useStyleEngineStore();

const viewBoxSize = 1024; // makemeahanzi 坐标系
const uid = Math.random().toString(36).slice(2, 9);
const filterId = `neon-filter-${uid}`;
const bgFilterId = `neon-bg-filter-${uid}`;

const strokes = ref<string[]>([]);

// 颜色
const color = computed(() => props.color || '#c9a96e');
const brightColor = computed(() => {
  const rgb = color.value.match(/\d+/g);
  if (!rgb) return '#e8d5a8';
  return `rgb(${Math.min(255, Number(rgb[0]) + 50)}, ${Math.min(255, Number(rgb[1]) + 50)}, ${Math.min(255, Number(rgb[2]) + 50)})`;
});

// 鼓点脉冲：用 beatSpike（持续峰值）而非 isBeat（50ms 单帧信号）
const beatSpike = computed(() => props.beatSpike ?? 0);
const beatScale = computed(() => 1.0 + beatSpike.value * 0.03);

// ==================== SVG path bounding box 解析 ====================

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 从 SVG path 数据中提取所有坐标点，计算近似 bounding box */
function getPathBBox(pathStr: string): BBox {
  const numbers = pathStr.match(/-?\d+\.?\d*/g);
  if (!numbers || numbers.length < 2) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // 每两个数字为一对 (x, y)
  for (let i = 0; i < numbers.length - 1; i += 2) {
    const x = parseFloat(numbers[i]);
    const y = parseFloat(numbers[i + 1]);
    if (!isNaN(x) && !isNaN(y)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** 计算两个 bbox 的重叠矩形，无重叠返回 null */
function getOverlap(a: BBox, b: BBox): BBox | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

// ==================== 笔画重叠检测 + mask 生成 ====================

interface MaskRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ProcessedStroke {
  path: string;
  index: number;
  maskRects: MaskRect[];
}

/**
 * 处理笔画数据：
 * - 第 1 个笔画（index=0）始终完整
 * - 后续笔画如果与之前任意笔画重叠，在重叠区域中心创建隐藏条带（断为两节）
 */
const processedStrokes = computed<ProcessedStroke[]>(() => {
  if (!strokes.value.length) return [];

  // 计算每个笔画的 bbox
  const bboxes = strokes.value.map((p) => getPathBBox(p));

  return strokes.value.map((path, j) => {
    const maskRects: MaskRect[] = [];

    if (j > 0) {
      // 检查与之前所有笔画的重叠
      for (let i = 0; i < j; i++) {
        const overlap = getOverlap(bboxes[i], bboxes[j]);
        if (overlap && overlap.width > 5 && overlap.height > 5) {
          // 在重叠区域中心创建间隙条带（隐藏中间 ~50% 区域）
          // 间隙方向取重叠区域较长的轴
          const gapRatio = 0.5;
          if (overlap.width >= overlap.height) {
            // 水平间隙：遮挡中间一段宽度
            const gapW = overlap.width * gapRatio;
            maskRects.push({
              x: overlap.x + (overlap.width - gapW) / 2,
              y: overlap.y,
              width: gapW,
              height: overlap.height,
            });
          } else {
            // 垂直间隙：遮挡中间一段高度
            const gapH = overlap.height * gapRatio;
            maskRects.push({
              x: overlap.x,
              y: overlap.y + (overlap.height - gapH) / 2,
              width: overlap.width,
              height: gapH,
            });
          }
        }
      }
    }

    return { path, index: j, maskRects };
  });
});

// 仅有 mask 的笔画（用于 v-for 渲染 <mask> 元素）
const maskStrokes = computed(() => processedStrokes.value.filter((s) => s.maskRects.length > 0));

// 加载笔画数据
onMounted(async () => {
  await loadDictionary();
  const s = getStrokes(props.char);
  if (s && s.length > 0) {
    strokes.value = s;
  }
});

// 监听字符变化
watch(
  () => props.char,
  async (newChar) => {
    const s = getStrokes(newChar);
    if (s && s.length > 0) {
      strokes.value = s;
    } else {
      strokes.value = [];
    }
  }
);
</script>

<style lang="scss" scoped>
.neon-stroke-svg {
  display: inline-block;
  width: 1em;
  height: 1em;
  overflow: visible;
  transform: scale(var(--beat-scale, 1));
  transition: transform 0.08s var(--m-ease-out, ease-out);
}

.neon-stroke-path {
  transition: opacity 0.2s ease;
}

.neon-tube,
.neon-bg-glow {
  transition: opacity 0.08s var(--m-ease-out, ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .neon-stroke-svg,
  .neon-tube,
  .neon-bg-glow {
    transition: none;
  }
}
</style>
