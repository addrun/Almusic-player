/**
 * useTapToggle — 移动端点击屏幕切换控件显隐
 *
 * 使用方式：
 * const { controlsVisible, handleTapToggle } = useTapToggle();
 *
 * 在模板中：
 * <div @click="handleTapToggle" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
 *   <div v-show="controlsVisible" class="control-bar">...</div>
 * </div>
 *
 * 行为：
 * - 移动端默认隐藏控件
 * - 点击屏幕（非交互元素区域）切换控件显隐
 * - 点击控件本身不触发切换（通过 .no-toggle 类标记）
 * - 非移动端保持原有 mousemove 自动隐藏逻辑
 */
import { ref, type Ref } from 'vue';

import { isMobile } from '@/utils';

export function useTapToggle(options?: {
  /** 非移动端自动隐藏延迟（毫秒），默认 3000 */
  autoHideDelay?: number;
  /** 初始状态，移动端默认 false，非移动端默认 true */
  initialVisible?: boolean;
}): {
  controlsVisible: Ref<boolean>;
  handleTapToggle: (e: TouchEvent | MouseEvent) => void;
  showControls: () => void;
  hideControls: () => void;
  resetHideTimer: () => void;
} {
  const autoHideDelay = options?.autoHideDelay ?? 3000;
  const initial = options?.initialVisible ?? (isMobile.value ? false : true);

  const controlsVisible = ref(initial);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  /** 显示控件，非移动端启动自动隐藏计时器 */
  function showControls() {
    controlsVisible.value = true;
    if (!isMobile.value) {
      resetHideTimer();
    }
  }

  /** 隐藏控件 */
  function hideControls() {
    controlsVisible.value = false;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  /** 重置自动隐藏计时器（非移动端） */
  function resetHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
    }
    hideTimer = setTimeout(() => {
      controlsVisible.value = false;
    }, autoHideDelay);
  }

  /** 点击屏幕切换控件显隐 */
  function handleTapToggle(e: TouchEvent | MouseEvent) {
    // 排除点击的是标记为 .no-toggle 的元素或其后代
    const target = e.target as HTMLElement;
    if (target?.closest('.no-toggle')) return;

    if (controlsVisible.value) {
      hideControls();
    } else {
      showControls();
    }
  }

  return {
    controlsVisible,
    handleTapToggle,
    showControls,
    hideControls,
    resetHideTimer
  };
}
