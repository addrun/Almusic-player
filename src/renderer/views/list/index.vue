<template>
  <div class="my-music-page" @wheel="onWheel">
    <!-- 无限封面网格 -->
    <div class="infinite-grid">
      <div
        v-for="(row, rowIndex) in gridRows"
        :key="rowIndex"
        class="grid-row"
        :class="{
          'row-right': row.dir === 'right',
          'is-dragging': isDragging && draggedRow === rowIndex,
          'is-hovered': hoveredRow === rowIndex
        }"
        :ref="(el) => setRowRef(el, rowIndex)"
        @mouseenter="hoveredRow = rowIndex"
        @mouseleave="onRowMouseLeave(rowIndex)"
      >
        <div
          class="grid-track"
          :style="{
            transform: `translateX(${rowOffsets[rowIndex] || 0}px)`,
            transition: trackTransition(rowIndex)
          }"
          @pointerdown="(e) => onPointerDown(e, rowIndex)"
        >
          <div
            v-for="(item, idx) in row.items"
            :key="`${rowIndex}-${idx}`"
            class="grid-cell"
            @click="handleItemClick(item, rowIndex)"
          >
            <img
              :src="getImgUrl(item.src, '200y200')"
              :alt="item.alt"
              draggable="false"
              class="cell-img"
              loading="lazy"
            />
            <div class="cell-overlay">
              <span class="cell-name">{{ item.alt }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 顶部标题（悬浮层） -->
    <div class="grid-header">
      <h2 class="grid-title">我的音乐</h2>
      <p class="grid-subtitle">{{ items.length }} 张专辑 · 悬停滚轮滑动 · 可拖动</p>
    </div>

    <!-- 底部渐变遮罩 -->
    <div class="grid-footer-fade"></div>

    <!-- 空状态 -->
    <div v-if="items.length === 0" class="empty-state">
      <i class="ri-disc-line"></i>
      <p>暂无歌单或专辑</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

import { useOverlayNavigate } from '@/hooks/useOverlayNavigate';
import { useUserStore } from '@/store';
import { getImgUrl } from '@/utils';

defineOptions({ name: 'MyMusic' });

const { navigate } = useOverlayNavigate();
const userStore = useUserStore();

// ==================== 数据 ====================
const items = computed(() => {
  const playlists = userStore.playList.map((pl: any) => ({
    id: pl.id,
    src: pl.coverImgUrl || '',
    alt: pl.name || '未知歌单',
    type: 'playlist' as const
  }));
  const albums = userStore.albumList.map((al: any) => ({
    id: al.id,
    src: al.picUrl || al.blurPicUrl || '',
    alt: al.name || '未知专辑',
    type: 'album' as const
  }));
  return [...playlists, ...albums];
});

// ==================== 行配置 ====================
const ROW_COUNT = 4;
const CELL_SIZE = 150;
const GAP = 14;
const MIN_PER_ROW = 14;
const DRAG_THRESHOLD = 8; // 拖动激活阈值（px），避免点击误判

const ROW_CONFIG = [
  { dir: 'right' as const, baseSpeed: 25 },
  { dir: 'left'  as const, baseSpeed: 30 },
  { dir: 'left'  as const, baseSpeed: 22 },
  { dir: 'right' as const, baseSpeed: 28 },
];

const gridRows = computed(() => {
  if (items.value.length === 0) return [];
  const total = items.value.length;
  const halfTotal = Math.ceil(total / 2);

  const rows = [];
  for (let i = 0; i < ROW_COUNT; i++) {
    const cfg = ROW_CONFIG[i];
    let startIdx: number;
    if (i === 1) {
      startIdx = 0;
    } else if (i === 2) {
      startIdx = halfTotal;
    } else {
      startIdx = Math.floor((i * 7 + 3) % total);
    }

    const rowItems = [];
    for (let j = 0; j < MIN_PER_ROW; j++) {
      rowItems.push(items.value[(startIdx + j) % total]);
    }

    rows.push({
      items: [...rowItems, ...rowItems],
      dir: cfg.dir,
      baseSpeed: cfg.baseSpeed
    });
  }
  return rows;
});

// ==================== 滚动偏移 ====================
const rowOffsets = reactive<Record<number, number>>({});
const rowRefs: HTMLElement[] = [];
// 缓存 halfWidth 避免每帧读取 DOM
const halfWidths = reactive<Record<number, number>>({});

const setRowRef = (el: any, index: number) => {
  if (el instanceof HTMLElement) rowRefs[index] = el;
};

function calcHalfWidth(rowIndex: number): number {
  const row = rowRefs[rowIndex];
  if (!row) return 0;
  const track = row.querySelector('.grid-track') as HTMLElement;
  if (!track || track.scrollWidth === 0) return 0;
  return track.scrollWidth / 2;
}

function refreshHalfWidths() {
  for (let i = 0; i < ROW_COUNT; i++) {
    halfWidths[i] = calcHalfWidth(i);
  }
}

// 取模规范化偏移到 [-halfWidth, 0]，避免 while 循环跳跃
function normalizeOffset(rowIndex: number) {
  const half = halfWidths[rowIndex];
  if (!half || half <= 1) return;
  let off = rowOffsets[rowIndex] || 0;
  // 用取模代替 while 循环，一步到位
  off = -(((-off) % half));
  if (off > 0) off -= half;
  if (off < -half) off += half;
  rowOffsets[rowIndex] = off;
}

// 初始化每行偏移
watch(gridRows, () => {
  nextTick(() => {
    refreshHalfWidths();
    for (let i = 0; i < gridRows.value.length; i++) {
      if (i === 1 || i === 2) {
        rowOffsets[i] = -(CELL_SIZE + GAP) * 2;
      } else {
        const half = halfWidths[i] || 1;
        rowOffsets[i] = -((CELL_SIZE + GAP) * (i * 3 + 1)) % half;
      }
    }
  });
}, { immediate: true });

// ==================== 自动滚动 ====================
const hoveredRow = ref<number | null>(null);
let rafId: number | null = null;
let lastTime = performance.now();

function autoScroll(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.1); // 限制最大帧时间
  lastTime = now;

  if (gridRows.value.length > 0) {
    for (let i = 0; i < gridRows.value.length; i++) {
      // 拖拽中或悬停暂停的行不自动滚动
      if (isDragging.value && draggedRow.value === i) continue;
      if (hoveredRow.value === i && !isDragging.value) continue;

      const row = gridRows.value[i];
      const speed = row.baseSpeed;
      const delta = row.dir === 'left' ? -speed : speed;
      rowOffsets[i] = (rowOffsets[i] || 0) + delta * dt;
      // 只有偏移超出范围时才 normalize，减少运算
      const half = halfWidths[i] || 0;
      if (half > 1 && (rowOffsets[i] < -half || rowOffsets[i] > 0)) {
        normalizeOffset(i);
      }
    }
  }
  rafId = requestAnimationFrame(autoScroll);
}

// ==================== 鼠标滚轮 ====================
const onWheel = (e: WheelEvent) => {
  if (hoveredRow.value !== null) {
    const delta = e.deltaY || e.deltaX;
    rowOffsets[hoveredRow.value] = (rowOffsets[hoveredRow.value] || 0) - delta * 0.8;
    normalizeOffset(hoveredRow.value);
    e.preventDefault();
  }
};

// ==================== 鼠标拖动（延迟激活） ====================
const isDragging = ref(false);
const draggedRow = ref<number | null>(null);

// pointerdown 记录起点，但不立即进入拖动模式
let pointerDownInfo: { x: number; row: number; offset: number } | null = null;

const onPointerDown = (e: PointerEvent, rowIndex: number) => {
  // 只响应左键
  if (e.button !== 0) return;
  pointerDownInfo = {
    x: e.clientX,
    row: rowIndex,
    offset: rowOffsets[rowIndex] || 0
  };
  // 不使用 setPointerCapture，否则会改变 pointerup 的 target，
  // 导致浏览器合成的 click 事件 target 变成 .grid-track 而非 .grid-cell，
  // .grid-cell 上的 @click 监听器不会触发
};

const onPointerMove = (e: PointerEvent) => {
  if (!pointerDownInfo) return;
  const dx = e.clientX - pointerDownInfo.x;

  // 只有明确移动超过阈值才进入拖拽模式
  if (!isDragging.value) {
    if (Math.abs(dx) <= DRAG_THRESHOLD) return;
    // 进入拖拽模式
    isDragging.value = true;
    draggedRow.value = pointerDownInfo.row;
  }

  // 拖拽中：直接跟随鼠标
  rowOffsets[pointerDownInfo.row] = pointerDownInfo.offset + dx;
};

const onPointerUp = () => {
  const wasDragging = isDragging.value;
  const row = pointerDownInfo?.row ?? null;

  if (wasDragging && row !== null) {
    normalizeOffset(row);
  }

  // 延迟重置，让 click 事件能判断是否拖动过
  setTimeout(() => {
    isDragging.value = false;
    draggedRow.value = null;
    pointerDownInfo = null;
  }, 50);
};

// 全局监听
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

// ==================== 行离开 ====================
const onRowMouseLeave = (rowIndex: number) => {
  if (hoveredRow.value === rowIndex) {
    hoveredRow.value = null;
  }
};

// ==================== 点击跳转 ====================
const handleItemClick = (item: any, _rowIndex: number) => {
  // 如果刚才在拖动，不触发点击
  if (isDragging.value) return;
  navigate(`/music-list/${item.id}?type=${item.type === 'album' ? 'album' : 'playlist'}`);
};

// ==================== 过渡样式 ====================
const trackTransition = (rowIndex: number) => {
  // 拖拽中无过渡
  if (isDragging.value && draggedRow.value === rowIndex) {
    return 'none';
  }
  // 悬停滚轮时无过渡（跟随滚轮即时响应）
  if (hoveredRow.value === rowIndex) {
    return 'none';
  }
  // 自动滚动无过渡（每帧更新）
  return 'none';
};

// ==================== 窗口 resize 重新计算 ====================
const onResize = () => {
  refreshHalfWidths();
  for (let i = 0; i < ROW_COUNT; i++) {
    normalizeOffset(i);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('resize', onResize);
}

// ==================== 生命周期 ====================
onMounted(() => {
  if (userStore.playList.length === 0 && userStore.user) userStore.initializePlaylist();
  if (userStore.albumList.length === 0 && userStore.user) userStore.initializeAlbumList();
  // 等 DOM 渲染完后计算 halfWidth
  nextTick(() => {
    refreshHalfWidths();
  });
  lastTime = performance.now();
  rafId = requestAnimationFrame(autoScroll);
});

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId);
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('resize', onResize);
  }
});
</script>

<style lang="scss" scoped>
.my-music-page {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background-color: #0a0a0a;
}

// ==================== 无限网格 ====================
.infinite-grid {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 0;
  overflow: hidden;
}

.grid-row {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  min-height: 0;
  mask-image: linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%);
  cursor: grab;

  &.is-dragging {
    cursor: grabbing;
  }
}

.grid-track {
  display: flex;
  gap: 14px;
  padding: 0 7px;
  will-change: transform;
}

// ==================== 封面单元格 ====================
.grid-cell {
  width: 150px;
  height: 150px;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  pointer-events: auto;

  &:hover {
    transform: scale(1.08);
    z-index: 2;
  }

  // 拖拽中禁止悬停放大
  .is-dragging & {
    &:hover {
      transform: none;
    }
  }
}

.cell-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

// 悬停遮罩
.cell-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  padding: 12px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 40%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;

  .grid-cell:hover & {
    opacity: 1;
  }

  // 拖拽中不显示遮罩
  .is-dragging & {
    opacity: 0 !important;
  }
}

.cell-name {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}

// ==================== 顶部标题 ====================
.grid-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  padding: 20px 28px 14px;
  background: linear-gradient(to bottom, rgba(10, 10, 10, 0.95) 0%, rgba(10, 10, 10, 0.6) 70%, transparent 100%);
  pointer-events: none;
}

.grid-title {
  font-size: 22px;
  font-weight: 700;
  color: #f0f0f0;
  margin: 0;
}

.grid-subtitle {
  font-size: 12px;
  color: #888;
  margin: 4px 0 0;
}

// ==================== 底部渐变 ====================
.grid-footer-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(to top, rgba(10, 10, 10, 0.9), transparent);
  pointer-events: none;
  z-index: 5;
}

// ==================== 空状态 ====================
.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #555;

  i {
    font-size: 56px;
    opacity: 0.4;
  }

  p {
    font-size: 14px;
  }
}

// ==================== 响应式 ====================
@media (max-width: 768px) {
  .grid-cell {
    width: 110px;
    height: 110px;
  }

  .grid-track {
    gap: 10px;
  }

  .grid-header {
    padding: 16px 20px 10px;
  }

  .grid-title {
    font-size: 18px;
  }
}
</style>
