<template>
  <div
    v-show="!win.minimized"
    class="floating-window"
    :class="{ 'fw-maximized': win.maximized, 'fw-active': isActive }"
    :style="windowStyle"
    @mousedown="focus"
  >
    <!-- 标题栏 -->
    <div class="fw-title-bar" @mousedown="startDrag">
      <div class="fw-title-left">
        <i v-if="win.icon" :class="win.icon" class="fw-title-icon" />
        <span class="fw-title-text">{{ win.title }}</span>
      </div>
      <div class="fw-title-actions" @mousedown.stop>
        <button class="fw-btn fw-btn-min" @click="toggleMinimize" title="最小化">
          <i class="ri-subtract-line" />
        </button>
        <button class="fw-btn fw-btn-max" @click="toggleMaximize" title="最大化">
          <i :class="win.maximized ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'" />
        </button>
        <button class="fw-btn fw-btn-close" @click="close" title="关闭">
          <i class="ri-close-line" />
        </button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="fw-content">
      <n-scrollbar>
        <div class="fw-content-inner">
          <component :is="loadedComponent" v-if="loadedComponent" />
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { WindowState } from '@/store/modules/windowStore';
import { useWindowStore } from '@/store/modules/windowStore';

const props = defineProps<{
  win: WindowState;
}>();

const windowStore = useWindowStore();

const isActive = computed(() => windowStore.activeWindowId === props.win.id);

const windowStyle = computed(() => {
  if (props.win.maximized) {
    return {
      left: '8px',
      top: '8px',
      width: 'calc(100vw - 16px)',
      height: 'calc(100vh - 16px)',
      zIndex: props.win.zIndex
    };
  }
  return {
    left: props.win.x + 'px',
    top: props.win.y + 'px',
    width: props.win.width + 'px',
    height: props.win.height + 'px',
    zIndex: props.win.zIndex
  };
});

// 异步加载组件
const loadedComponent = ref<any>(null);
const loadComponent = async () => {
  try {
    const mod = await props.win.component();
    loadedComponent.value = mod.default || mod;
  } catch (e) {
    console.error('[FloatingWindow] 组件加载失败:', e);
  }
};

onMounted(() => {
  loadComponent();
});

// 如果组件引用变化
watch(() => props.win.component, () => {
  loadComponent();
});

const focus = () => {
  windowStore.focusWindow(props.win.id);
};

// ==================== 拖拽逻辑 ====================
let dragStartX = 0;
let dragStartY = 0;
let winStartX = 0;
let winStartY = 0;
let isDragging = false;

const startDrag = (e: MouseEvent) => {
  if (props.win.maximized) return;
  // 仅左键拖拽
  if (e.button !== 0) return;

  dragStartX = e.clientX;
  dragStartY = e.clientY;
  winStartX = props.win.x;
  winStartY = props.win.y;
  isDragging = true;

  windowStore.focusWindow(props.win.id);

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  e.preventDefault();
};

const onDragMove = (e: MouseEvent) => {
  if (!isDragging) return;
  const deltaX = e.clientX - dragStartX;
  const deltaY = e.clientY - dragStartY;
  let newX = winStartX + deltaX;
  let newY = winStartY + deltaY;

  // 边界约束
  const maxX = window.innerWidth - 100;
  const maxY = window.innerHeight - 40;
  newX = Math.max(-props.win.width + 100, Math.min(newX, maxX));
  newY = Math.max(0, Math.min(newY, maxY));

  windowStore.updatePosition(props.win.id, newX, newY);
};

const onDragEnd = () => {
  isDragging = false;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
};

// ==================== 窗口操作 ====================
const close = () => {
  windowStore.closeWindow(props.win.id);
};

const toggleMinimize = () => {
  windowStore.toggleMinimize(props.win.id);
};

const toggleMaximize = () => {
  windowStore.toggleMaximize(props.win.id);
};
</script>

<style lang="scss" scoped>
.floating-window {
  position: fixed;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.18),
    0 4px 12px rgba(0, 0, 0, 0.08);
  transition:
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.dark .floating-window {
  background: rgba(30, 30, 30, 0.85);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 4px 12px rgba(0, 0, 0, 0.2);
}

.floating-window.fw-active {
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.22),
    0 6px 16px rgba(0, 0, 0, 0.1);
}

.dark .floating-window.fw-active {
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    0 6px 16px rgba(0, 0, 0, 0.25);
}

.fw-maximized {
  border-radius: 12px;
}

// 标题栏
.fw-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 6px 0 14px;
  background: rgba(0, 0, 0, 0.03);
  cursor: grab;
  user-select: none;
  flex-shrink: 0;

  &:active {
    cursor: grabbing;
  }
}

.dark .fw-title-bar {
  background: rgba(255, 255, 255, 0.04);
}

.fw-title-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.fw-title-icon {
  font-size: 14px;
  color: #9ca3af;
  flex-shrink: 0;
}

.fw-title-text {
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dark .fw-title-text {
  color: #d1d5db;
}

.fw-title-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.fw-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.12s;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }
}

.dark .fw-btn {
  color: #9ca3af;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}

.fw-btn-close:hover {
  background: #ef4444 !important;
  color: #fff !important;
}

// 内容区域
.fw-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.fw-content-inner {
  min-height: 100%;
  padding: 0;
}
</style>
