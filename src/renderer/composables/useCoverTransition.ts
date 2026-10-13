/**
 * useCoverTransition — 封面过渡动画 composable
 *
 * 在 Smart Mix crossfade 期间用 GSAP 驱动：
 *   1. 模糊量 blurAmount 缓入后持续振荡，直到「歌名/作者已更新」且「覆盖层满显」
 *      两个条件同时满足后才开始淡出 → 0
 *   2. 下一首封面作为临时覆盖层 overlaySrc 渐显（opacity 0→1）
 *   3. 覆盖层满不透明后，底层 displaySrc swap 为下一首 URL，删除覆盖层
 *
 * 模糊的消失不再绑定固定时长，而是绑定「数据就绪」信号：
 *   - overlayReady：覆盖层 opacity 达到 1
 *   - songReady：currentSrc 发生变化（playerCore.playMusic 已被
 *     smartMixService.completeTransition 更新为下一首）
 *   两者同时满足后，模糊才从峰值缓出到 0。
 */

import { gsap } from 'gsap';
import { computed, type ComputedRef, ref, watch } from 'vue';

import { useTransitionStore } from '@/store/modules/transition';

export interface CoverTransitionOptions {
  /** 当前封面 URL（响应式，正常播放时随 playMusic.picUrl 变化） */
  currentSrc: ComputedRef<string>;
  /** 把 transitionStore 里的原始 picUrl 格式化为与 currentSrc 同尺寸的 URL */
  formatNextUrl: (rawUrl: string) => string;
}

export function useCoverTransition(opts: CoverTransitionOptions) {
  const transitionStore = useTransitionStore();

  // ==================== 响应式动画值 ====================
  const blurAmount = ref(0);
  const overlayOpacity = ref(0);
  const overlaySrc = ref<string | null>(null);
  const displaySrc = ref(opts.currentSrc.value);

  // GSAP 动画句柄
  let overlayTween: gsap.core.Tween | null = null;
  let blurRampTween: gsap.core.Tween | null = null;
  let blurOscillation: gsap.core.Timeline | null = null;
  let blurFadeOutTween: gsap.core.Tween | null = null;

  // 就绪标志
  let overlayReady = false;
  let songReady = false;
  let cancelled = false;

  // 不在过渡时，displaySrc 跟随 currentSrc；
  // 在过渡时，currentSrc 变化意味着 playerCore.playMusic 已更新（songReady）
  watch(opts.currentSrc, (newSrc) => {
    if (!transitionStore.isCrossfadingUI) {
      displaySrc.value = newSrc;
    } else if (!songReady) {
      // 过渡期间 currentSrc 变化 = 歌曲数据已更新
      songReady = true;
      checkAndFadeOut();
    }
  });

  // 监听过渡状态启停
  watch(
    () => transitionStore.isCrossfadingUI,
    (active) => {
      if (active) {
        startTransition();
      } else {
        finishTransition();
      }
    }
  );

  // ==================== 过渡启动 ====================
  function startTransition() {
    const rawNext = transitionStore.nextCoverUrl;
    const duration = transitionStore.duration || 8;

    // 清理上一次残留
    killAll();
    cancelled = false;
    overlayReady = false;
    songReady = false;
    overlayOpacity.value = 0;
    blurAmount.value = 0;
    // displaySrc 保持当前封面不动（等 swap 时才换）

    if (!rawNext) {
      // 无下一首封面 URL：仅做模糊动画，无覆盖层
      // overlayReady 直接置 true（没有覆盖层要等）
      overlayReady = true;
      runBlurOnly(duration);
      return;
    }

    const nextUrl = opts.formatNextUrl(rawNext);
    overlaySrc.value = nextUrl;
    overlayOpacity.value = 0;

    // ---- 覆盖层渐显：0 → 1，全程 power2.inOut ----
    overlayTween = gsap.to(overlayOpacity, {
      value: 1,
      duration,
      ease: 'power2.inOut',
      onComplete: () => {
        overlayReady = true;
        swapCover();
        checkAndFadeOut();
      }
    });

    // ---- 模糊缓入：0 → 12px ----
    const rampUpDur = Math.min(duration, 4) * 0.3;
    blurRampTween = gsap.to(blurAmount, {
      value: 12,
      duration: rampUpDur,
      ease: 'power2.in',
      onComplete: () => {
        if (!cancelled) startOscillation();
      }
    });
  }

  /** 模糊振荡：8 ↔ 12 无限循环，直到 checkAndFadeOut 杀掉它 */
  function startOscillation() {
    blurOscillation = gsap.timeline({ repeat: -1, yoyo: true });
    blurOscillation.to(blurAmount, {
      value: 8,
      duration: 0.8,
      ease: 'sine.inOut'
    });
    blurOscillation.to(blurAmount, {
      value: 12,
      duration: 0.8,
      ease: 'sine.inOut'
    });
  }

  /** 无覆盖层时仅做模糊：缓入→振荡，等 songReady 后淡出 */
  function runBlurOnly(duration: number) {
    const rampUpDur = Math.min(duration, 4) * 0.3;
    blurRampTween = gsap.to(blurAmount, {
      value: 12,
      duration: rampUpDur,
      ease: 'power2.in',
      onComplete: () => {
        if (!cancelled) startOscillation();
      }
    });
  }

  // ==================== 双条件就绪 → 淡出模糊 ====================
  function checkAndFadeOut() {
    if (overlayReady && songReady && !cancelled) {
      // 杀掉振荡
      if (blurOscillation) {
        blurOscillation.kill();
        blurOscillation = null;
      }
      // 从当前值缓出到 0
      blurFadeOutTween = gsap.to(blurAmount, {
        value: 0,
        duration: 0.5,
        ease: 'power2.out'
      });
    }
  }

  // ==================== 覆盖层满显 → swap 底层 ====================
  function swapCover() {
    const rawNext = transitionStore.nextCoverUrl;
    if (rawNext) {
      displaySrc.value = opts.formatNextUrl(rawNext);
    }
    // 删除覆盖层（视觉无变化，因此时满不透明）
    overlaySrc.value = null;
    overlayOpacity.value = 0;
  }

  // ==================== 过渡结束 / 取消 ====================
  function finishTransition() {
    cancelled = true;
    // 杀掉振荡、缓入、覆盖层渐显（不再需要）
    if (overlayTween) { overlayTween.kill(); overlayTween = null; }
    if (blurRampTween) { blurRampTween.kill(); blurRampTween = null; }
    if (blurOscillation) { blurOscillation.kill(); blurOscillation = null; }

    // 清理覆盖层
    overlayOpacity.value = 0;
    overlaySrc.value = null;
    // 回到当前封面（此时 playerCore.playMusic 已更新，currentSrc 是新歌）
    displaySrc.value = opts.currentSrc.value;

    // 模糊从当前值缓出到 0，而非瞬间消失
    if (blurAmount.value > 0.01) {
      if (blurFadeOutTween) { blurFadeOutTween.kill(); }
      blurFadeOutTween = gsap.to(blurAmount, {
        value: 0,
        duration: 0.5,
        ease: 'power2.out',
        onComplete: () => { blurFadeOutTween = null; }
      });
    } else {
      blurFadeOutTween = null;
    }
  }

  function killAll() {
    if (overlayTween) { overlayTween.kill(); overlayTween = null; }
    if (blurRampTween) { blurRampTween.kill(); blurRampTween = null; }
    if (blurOscillation) { blurOscillation.kill(); blurOscillation = null; }
    if (blurFadeOutTween) { blurFadeOutTween.kill(); blurFadeOutTween = null; }
  }

  // ==================== 对外暴露的 computed style ====================
  /** 给封面容器 / 歌名作者绑定的 :style */
  const blurStyle = computed(() => {
    const b = blurAmount.value;
    return b > 0.01 ? { filter: `blur(${b.toFixed(2)}px)` } : {};
  });

  return {
    blurAmount,
    overlayOpacity,
    overlaySrc,
    displaySrc,
    blurStyle,
    // 清理（供 onUnmounted 调用）
    dispose: () => killAll()
  };
}
