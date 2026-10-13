<template>
  <!-- 透明遮罩层：点击空白区域关闭面板 -->
  <div
    class="fp-backdrop"
    @mousedown="onBackdropMouseDown"
  >
    <div
      class="floating-panel"
      :style="panelStyle"
      @mousedown.stop="focus"
    >
      <!-- 标题栏（细薄，仅标题+关闭） -->
      <div class="fp-header">
        <span class="fp-title">{{ windowStore.panelTitle }}</span>
        <button class="fp-close" @click="close" title="关闭">
          <i class="ri-close-line" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="fp-content">
        <div class="fp-content-inner">
          <!-- 加载中 -->
          <div v-if="componentLoading" class="fp-loading">
            <n-spin size="medium" />
            <span class="fp-loading-text">加载中...</span>
          </div>
          <!-- 已加载 -->
          <component
            :is="loadedComponent"
            v-else-if="loadedComponent"
            :key="windowStore.panelKey"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NSpin } from 'naive-ui';
import { useWindowStore } from '@/store/modules/windowStore';
import { useSettingsStore } from '@/store/modules/settings';

const windowStore = useWindowStore();
const settingsStore = useSettingsStore();

// 面板定位：左边缘紧贴侧栏右侧，Y 坐标对齐触发按钮
const SIDEBAR_WIDTH_COLLAPSED = 64; // 侧栏收起态宽度 + margin
const SIDEBAR_WIDTH_EXPANDED = 220; // 侧栏展开态宽度 + margin
const PLAY_BAR_HEIGHT = 90; // 底部播放栏预留高度
const PANEL_MAX_HEIGHT = 600;
const PANEL_WIDTH = 720;

const panelStyle = computed(() => {
  const sidebarW = settingsStore.isSidebarExpanded
    ? SIDEBAR_WIDTH_EXPANDED
    : SIDEBAR_WIDTH_COLLAPSED;

  let y = windowStore.panelY;
  // 约束底部不超过播放栏
  const maxY = window.innerHeight - PLAY_BAR_HEIGHT - PANEL_MAX_HEIGHT - 16;
  if (y > maxY) y = Math.max(16, maxY);

  return {
    left: sidebarW + 'px',
    top: y + 'px',
    width: PANEL_WIDTH + 'px',
    maxHeight: `calc(100vh - ${y + PLAY_BAR_HEIGHT + 16}px)`,
    zIndex: 150
  };
});

// 异步加载组件
const loadedComponent = ref<any>(null);
const componentLoading = ref(false);
const loadComponent = async () => {
  if (!windowStore.panelComponent) {
    loadedComponent.value = null;
    componentLoading.value = false;
    return;
  }
  componentLoading.value = true;
  loadedComponent.value = null;
  try {
    const mod = await windowStore.panelComponent();
    loadedComponent.value = mod.default || mod;
  } catch (e) {
    console.error('[FloatingPanel] 组件加载失败:', e);
  } finally {
    componentLoading.value = false;
  }
};

watch(() => windowStore.panelKey, () => loadComponent(), { immediate: true });

const focus = () => {
  // 面板始终在最前，无需额外操作
};

// 点击空白区域关闭面板（仅在 mousedown 位置未移动时触发，避免拖选文本误关闭）
let backdropDownX = 0;
let backdropDownY = 0;
const onBackdropMouseDown = (e: MouseEvent) => {
  // 只响应左键
  if (e.button !== 0) return;
  backdropDownX = e.clientX;
  backdropDownY = e.clientY;
  // 在 mouseup 时检查是否为点击（非拖选）
  const onUp = (upEvent: MouseEvent) => {
    document.removeEventListener('mouseup', onUp, { capture: true });
    const dx = Math.abs(upEvent.clientX - backdropDownX);
    const dy = Math.abs(upEvent.clientY - backdropDownY);
    // 移动超过 5px 视为拖选，不关闭
    if (dx < 5 && dy < 5) {
      close();
    }
  };
  document.addEventListener('mouseup', onUp, { capture: true, once: true });
};

const close = () => {
  windowStore.closePanel();
};
</script>

<style lang="scss" scoped>
.fp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 149;
}

.floating-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px) saturate(1.8);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.15),
    0 4px 12px rgba(0, 0, 0, 0.06);
  animation: fp-in 0.22s cubic-bezier(0.2, 0, 0.1, 1);
}

.dark .floating-panel {
  background: rgba(30, 30, 30, 0.85);
  border-color: rgba(255, 255, 255, 0.06);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    0 4px 12px rgba(0, 0, 0, 0.2);
}

@keyframes fp-in {
  from {
    opacity: 0;
    transform: translateX(-12px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

// 标题栏
.fp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 10px 0 16px;
  background: rgba(0, 0, 0, 0.03);
  flex-shrink: 0;
}

.dark .fp-header {
  background: rgba(255, 255, 255, 0.04);
}

.fp-title {
  font-size: 12px;
  font-weight: 600;
  color: #4b5563;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dark .fp-title {
  color: #d1d5db;
}

.fp-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.12s;

  &:hover {
    background: #ef4444;
    color: #fff;
  }
}

.dark .fp-close {
  color: #9ca3af;
  &:hover {
    background: #ef4444;
    color: #fff;
  }
}

// 内容
.fp-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.fp-content-inner {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

// 加载状态
.fp-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
}

.fp-loading-text {
  font-size: 13px;
  color: #9ca3af;
}

.dark .fp-loading-text {
  color: #6b7280;
}
</style>
