/**
 * 舞台播放器动画预设库
 *
 * 提供普通模式（整句动画）和节奏模式（逐词动画）的动画预设
 * 所有动画函数返回 gsap.core.Timeline 以支持灵活控制
 *
 * 使用 GSAP 最佳实践：
 * - 使用 camelCase 属性名
 * - 优先使用 transform 别名（x, y, scale, rotation）
 * - 使用 autoAlpha 代替 opacity 进行淡入淡出
 * - 存储 timeline/tween 返回值以便控制
 * - 使用内置 ease 字符串
 */

import gsap from 'gsap'

// 动画函数类型定义
export type AnimationFn = (
  element: HTMLElement,
  options?: { energy?: number; duration?: number }
) => gsap.core.Timeline

// 高潮能量级别常量
const ENERGY_NORMAL = 1.0
const ENERGY_MIN = 0.5
const ENERGY_MAX = 2.0

/**
 * 创建时间线，自动处理 prefers-reduced-motion
 */
function createTimeline(reducedMotion = false): gsap.core.Timeline {
  if (reducedMotion) {
    // 如果用户偏好减少动画，创建一个无动画的时间线
    const tl = gsap.timeline()
    return tl
  }
  return gsap.timeline()
}

/**
 * 检查用户是否偏好减少动画
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 根据能量级别调整动画强度
 * energy 范围：0.5 - 2.0，默认 1.0
 */
function scaleByEnergy(value: number, energy: number): number {
  const clamped = Math.max(ENERGY_MIN, Math.min(ENERGY_MAX, energy))
  return value * (clamped / ENERGY_NORMAL)
}

// ==================== 普通模式动画 ====================

/**
 * 从右侧滑入动画
 * 整句从右侧 60px 滑入，配合淡入效果
 */
export const slideRight: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.6 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(60, energy)

  tl.fromTo(
    element,
    {
      x: slideDistance,
      autoAlpha: 0,
    },
    {
      x: 0,
      autoAlpha: 1,
      duration,
      ease: 'power2.out',
    }
  )

  return tl
}

/**
 * 从左侧滑入动画
 * 整句从左侧 60px 滑入，配合淡入效果
 */
export const slideLeft: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.6 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(60, energy)

  tl.fromTo(
    element,
    {
      x: -slideDistance,
      autoAlpha: 0,
    },
    {
      x: 0,
      autoAlpha: 1,
      duration,
      ease: 'power2.out',
    }
  )

  return tl
}

/**
 * 从上方滑入动画
 * 整句从上方 40px 滑入，配合淡入效果
 */
export const slideTop: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.6 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(40, energy)

  tl.fromTo(
    element,
    {
      y: -slideDistance,
      autoAlpha: 0,
    },
    {
      y: 0,
      autoAlpha: 1,
      duration,
      ease: 'power2.out',
    }
  )

  return tl
}

/**
 * 从下方滑入动画
 * 整句从下方 40px 滑入，配合淡入效果
 */
export const slideBottom: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.6 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(40, energy)

  tl.fromTo(
    element,
    {
      y: slideDistance,
      autoAlpha: 0,
    },
    {
      y: 0,
      autoAlpha: 1,
      duration,
      ease: 'power2.out',
    }
  )

  return tl
}

/**
 * 淡入动画
 * 整句从透明到不透明，纯 opacity 过渡
 */
export const fadeIn: AnimationFn = (element, options = {}) => {
  const { duration = 0.5 } = options
  const tl = createTimeline(prefersReducedMotion())

  tl.fromTo(
    element,
    { autoAlpha: 0 },
    {
      autoAlpha: 1,
      duration,
      ease: 'power2.out',
    }
  )

  return tl
}

/**
 * 逐字淡入动画
 * 每个字符依次从透明到不透明，间隔 50ms
 * 适用于需要强调文字节奏的场景
 */
export const wordByWord: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.3 } = options
  const tl = createTimeline(prefersReducedMotion())
  const text = element.textContent || ''

  // 清空元素内容，为逐字动画做准备
  element.textContent = ''

  // 为每个字符创建 span 元素
  const chars: HTMLSpanElement[] = []
  for (const char of text) {
    const span = document.createElement('span')
    span.textContent = char
    span.style.display = 'inline-block'
    span.style.opacity = '0'
    element.appendChild(span)
    chars.push(span)
  }

  // 根据能量级别调整间隔时间（高能量间隔更短）
  const baseInterval = scaleByEnergy(50, energy)
  const interval = Math.max(30, baseInterval) // 最小间隔 30ms

  // 逐字动画
  chars.forEach((char, index) => {
    tl.to(
      char,
      {
        autoAlpha: 1,
        duration: duration * 0.5,
        ease: 'power2.out',
      },
      index * interval / 1000 // 转换为秒
    )
  })

  return tl
}

/**
 * 缩放进入动画
 * 从 scale(0.5) 放大到 scale(1)，配合淡入效果
 */
export const scaleIn: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.7 } = options
  const tl = createTimeline(prefersReducedMotion())
  const scaleFrom = 1 - scaleByEnergy(0.5, energy)

  tl.fromTo(
    element,
    {
      scale: Math.max(0.2, scaleFrom),
      autoAlpha: 0,
    },
    {
      scale: 1,
      autoAlpha: 1,
      duration,
      ease: 'back.out(1.7)',
    }
  )

  // 动画完成后清除所有动画属性
  tl.eventCallback('onComplete', () => {
    gsap.set(element, { clearProps: 'scale,autoAlpha,opacity,transform' })
  })

  // 动画被中断时也清除属性
  tl.eventCallback('onInterrupt', () => {
    gsap.set(element, { clearProps: 'scale,autoAlpha,opacity,transform' })
  })

  return tl
}

/**
 * 模糊进入动画
 * 从 blur(8px) 恢复清晰，配合淡入效果
 */
export const blurIn: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.6 } = options
  const tl = createTimeline(prefersReducedMotion())
  const blurAmount = scaleByEnergy(8, energy)

  tl.fromTo(
    element,
    {
      filter: `blur(${blurAmount}px)`,
      autoAlpha: 0,
    },
    {
      filter: 'blur(0px)',
      autoAlpha: 1,
      duration,
      ease: 'power2.out',
    }
  )

  // 动画完成后清除 filter 属性，避免影响性能
  tl.eventCallback('onComplete', () => {
    gsap.set(element, { clearProps: 'filter,autoAlpha,opacity' })
  })

  // 动画被中断时也清除属性
  tl.eventCallback('onInterrupt', () => {
    gsap.set(element, { clearProps: 'filter,autoAlpha,opacity' })
  })

  return tl
}

// ==================== 节奏模式动画（逐词动画） ====================

/**
 * 砸落效果动画
 * 词从上方砸落，带有弹跳效果
 * 适用于词间间隔 > 300ms 的场景
 */
export const wordDrop: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.5 } = options
  const tl = createTimeline(prefersReducedMotion())
  const dropDistance = scaleByEnergy(80, energy)

  tl.fromTo(
    element,
    {
      y: -dropDistance,
      autoAlpha: 0,
    },
    {
      y: 0,
      autoAlpha: 1,
      duration,
      ease: 'bounce.out',
    }
  )

  return tl
}

/**
 * 颤抖效果动画
 * 词在原地快速颤抖，适用于拉长音 > 800ms 的场景
 * 颤抖幅度根据能量级别调整
 */
export const wordVibrate: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.8 } = options
  const tl = createTimeline(prefersReducedMotion())
  const vibrateAmount = scaleByEnergy(3, energy)
  const vibrateCount = Math.round(scaleByEnergy(4, energy))

  // 初始淡入
  tl.fromTo(
    element,
    { autoAlpha: 0 },
    { autoAlpha: 1, duration: duration * 0.2, ease: 'power2.out' }
  )

  // 颤抖效果
  tl.to(element, {
    x: `+=${vibrateAmount}`,
    duration: duration * 0.1,
    ease: 'none',
    repeat: vibrateCount,
    yoyo: true,
  })

  // 确保最终位置回到原点
  tl.to(element, {
    x: 0,
    duration: duration * 0.1,
    ease: 'power2.out',
  })

  tl.eventCallback('onComplete', () => {
    gsap.set(element, { clearProps: 'all' })
  })
  tl.eventCallback('onInterrupt', () => {
    gsap.set(element, { clearProps: 'all' })
  })

  return tl
}

/**
 * 普通淡入动画（节奏模式默认）
 * 词逐个淡入，适用于普通节奏场景
 */
export const wordNormal: AnimationFn = (element, options = {}) => {
  const { duration = 0.3 } = options
  const tl = createTimeline(prefersReducedMotion())

  tl.fromTo(
    element,
    { autoAlpha: 0 },
    {
      autoAlpha: 1,
      duration,
      ease: 'power2.out',
    }
  )

  return tl
}

// ==================== 退场动画 ====================

/**
 * 统一退场动画
 * 所有歌词退出时使用此动画
 * 使用 power2.in 缓动，快速淡出
 */
export const exit: AnimationFn = (element, options = {}) => {
  const { duration = 0.3 } = options
  const tl = createTimeline(prefersReducedMotion())

  tl.to(element, {
    autoAlpha: 0,
    duration,
    ease: 'power2.in',
  })

  return tl
}

// ==================== 动画集合 ====================

/**
 * 所有普通模式动画的数组，按索引排列
 * 索引对应关系：
 * 0 - slideRight（右侧滑入）
 * 1 - slideLeft（左侧滑入）
 * 2 - slideTop（上方滑入）
 * 3 - slideBottom（下方滑入）
 * 4 - fadeIn（淡入）
 * 5 - scaleIn（缩放进入）
 * 6 - blurIn（模糊进入）
 *
 * 注意：wordByWord 不在此数组中，因为它会修改 DOM 结构（清空 textContent 创建 span）
 * 只用于节奏模式的逐词显示
 */
export const normalAnimations: AnimationFn[] = [
  slideRight,
  slideLeft,
  slideTop,
  slideBottom,
  fadeIn,
  scaleIn,
  blurIn,
]

/**
 * 所有节奏模式动画的数组，按索引排列
 * 索引对应关系：
 * 0 - wordDrop（砸落效果）
 * 1 - wordVibrate（颤抖效果）
 * 2 - wordNormal（普通淡入）
 */
export const rhythmAnimations: AnimationFn[] = [
  wordDrop,
  wordVibrate,
  wordNormal,
]

// ==================== 力量模式动画 ====================

/**
 * 力量模式 - 从更远距离快速滑入，时长更短，速度更快
 */
export const powerSlideRight: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.3 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(150, energy)

  tl.fromTo(element, { x: slideDistance, autoAlpha: 0 }, {
    x: 0, autoAlpha: 1, duration, ease: 'power5.out',
  })
  return tl
}

export const powerSlideLeft: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.3 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(150, energy)

  tl.fromTo(element, { x: -slideDistance, autoAlpha: 0 }, {
    x: 0, autoAlpha: 1, duration, ease: 'power5.out',
  })
  return tl
}

export const powerSlideTop: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.3 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(120, energy)

  tl.fromTo(element, { y: -slideDistance, autoAlpha: 0 }, {
    y: 0, autoAlpha: 1, duration, ease: 'power5.out',
  })
  return tl
}

export const powerSlideBottom: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.3 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(120, energy)

  tl.fromTo(element, { y: slideDistance, autoAlpha: 0 }, {
    y: 0, autoAlpha: 1, duration, ease: 'power5.out',
  })
  return tl
}

/**
 * 力量模式 - 快速淡入
 */
export const powerFadeIn: AnimationFn = (element, options = {}) => {
  const { duration = 0.2 } = options
  const tl = createTimeline(prefersReducedMotion())

  tl.fromTo(element, { autoAlpha: 0 }, {
    autoAlpha: 1, duration, ease: 'power4.out',
  })
  return tl
}

/**
 * 力量模式 - 极速逐字，间隔极短
 */
export const powerWordByWord: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.15 } = options
  const tl = createTimeline(prefersReducedMotion())
  const text = element.textContent || ''
  element.textContent = ''
  const chars: HTMLSpanElement[] = []
  for (const char of text) {
    const span = document.createElement('span')
    span.textContent = char
    span.style.display = 'inline-block'
    span.style.opacity = '0'
    element.appendChild(span)
    chars.push(span)
  }
  const interval = Math.max(10, scaleByEnergy(18, energy))

  chars.forEach((char, index) => {
    tl.to(char, {
      autoAlpha: 1, duration: duration * 0.3, ease: 'power4.out',
    }, index * interval / 1000)
  })
  return tl
}

/**
 * 力量模式 - 从极小缩放 + 弹性弹跳进入
 */
export const powerScaleIn: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.4 } = options
  const tl = createTimeline(prefersReducedMotion())
  const scaleFrom = Math.max(0.1, 1 - scaleByEnergy(0.9, energy))

  tl.fromTo(element, { scale: scaleFrom, autoAlpha: 0 }, {
    scale: 1, autoAlpha: 1, duration, ease: 'elastic.out(1, 0.4)',
  })
  tl.eventCallback('onComplete', () => {
    gsap.set(element, { clearProps: 'all' })
  })
  tl.eventCallback('onInterrupt', () => {
    gsap.set(element, { clearProps: 'all' })
  })
  return tl
}

/**
 * 力量模式 - 从强模糊极快恢复
 */
export const powerBlurIn: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.3 } = options
  const tl = createTimeline(prefersReducedMotion())
  const blurAmount = scaleByEnergy(20, energy)

  tl.fromTo(element, { filter: `blur(${blurAmount}px)`, autoAlpha: 0 }, {
    filter: 'blur(0px)', autoAlpha: 1, duration, ease: 'power5.out',
  })
  tl.eventCallback('onComplete', () => {
    gsap.set(element, { clearProps: 'all' })
  })
  tl.eventCallback('onInterrupt', () => {
    gsap.set(element, { clearProps: 'all' })
  })
  return tl
}

/**
 * 力量模式 - 砸落效果，更重更猛
 */
export const powerWordDrop: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.25 } = options
  const tl = createTimeline(prefersReducedMotion())
  const dropDistance = scaleByEnergy(150, energy)

  tl.fromTo(element, { y: -dropDistance, autoAlpha: 0, scale: 1.3 }, {
    y: 0, autoAlpha: 1, scale: 1, duration, ease: 'bounce.out',
  })
  return tl
}

/**
 * 力量模式 - 颤抖幅度更大，更剧烈
 */
export const powerWordVibrate: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.4 } = options
  const tl = createTimeline(prefersReducedMotion())
  const vibrateAmount = scaleByEnergy(8, energy)
  const vibrateCount = Math.round(scaleByEnergy(6, energy))

  tl.fromTo(element, { autoAlpha: 0 }, { autoAlpha: 1, duration: duration * 0.1, ease: 'power4.out' })
  tl.to(element, {
    x: `+=${vibrateAmount}`, duration: duration * 0.05, ease: 'none', repeat: vibrateCount, yoyo: true,
  })
  tl.to(element, { x: 0, duration: duration * 0.05, ease: 'power4.out' })
  tl.eventCallback('onComplete', () => {
    gsap.set(element, { clearProps: 'all' })
  })
  tl.eventCallback('onInterrupt', () => {
    gsap.set(element, { clearProps: 'all' })
  })
  return tl
}

/**
 * 力量模式 - 极速逐词淡入
 */
export const powerWordNormal: AnimationFn = (element, options = {}) => {
  const { duration = 0.15 } = options
  const tl = createTimeline(prefersReducedMotion())

  tl.fromTo(element, { autoAlpha: 0 }, {
    autoAlpha: 1, duration, ease: 'power5.out',
  })
  return tl
}

// ==================== 柔和模式动画 ====================

/**
 * 柔和模式 - 更慢更缓的滑入
 */
export const softSlideRight: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.9 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(40, energy)

  tl.fromTo(element, { x: slideDistance, autoAlpha: 0 }, {
    x: 0, autoAlpha: 1, duration, ease: 'power1.out',
  })
  return tl
}

export const softSlideLeft: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.9 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(40, energy)

  tl.fromTo(element, { x: -slideDistance, autoAlpha: 0 }, {
    x: 0, autoAlpha: 1, duration, ease: 'power1.out',
  })
  return tl
}

export const softSlideTop: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.9 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(25, energy)

  tl.fromTo(element, { y: -slideDistance, autoAlpha: 0 }, {
    y: 0, autoAlpha: 1, duration, ease: 'power1.out',
  })
  return tl
}

export const softSlideBottom: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.9 } = options
  const tl = createTimeline(prefersReducedMotion())
  const slideDistance = scaleByEnergy(25, energy)

  tl.fromTo(element, { y: slideDistance, autoAlpha: 0 }, {
    y: 0, autoAlpha: 1, duration, ease: 'power1.out',
  })
  return tl
}

export const softFadeIn: AnimationFn = (element, options = {}) => {
  const { duration = 0.8 } = options
  const tl = createTimeline(prefersReducedMotion())

  tl.fromTo(element, { autoAlpha: 0 }, {
    autoAlpha: 1, duration, ease: 'power1.out',
  })
  return tl
}

export const softWordByWord: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.4 } = options
  const tl = createTimeline(prefersReducedMotion())
  const text = element.textContent || ''
  element.textContent = ''
  const chars: HTMLSpanElement[] = []
  for (const char of text) {
    const span = document.createElement('span')
    span.textContent = char
    span.style.display = 'inline-block'
    span.style.opacity = '0'
    element.appendChild(span)
    chars.push(span)
  }
  const interval = Math.max(60, scaleByEnergy(80, energy))

  chars.forEach((char, index) => {
    tl.to(char, {
      autoAlpha: 1, duration: duration * 0.6, ease: 'power1.out',
    }, index * interval / 1000)
  })
  return tl
}

export const softScaleIn: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.8 } = options
  const tl = createTimeline(prefersReducedMotion())
  const scaleFrom = Math.max(0.85, 1 - scaleByEnergy(0.15, energy))

  tl.fromTo(element, { scale: scaleFrom, autoAlpha: 0 }, {
    scale: 1, autoAlpha: 1, duration, ease: 'power1.out',
  })
  tl.eventCallback('onComplete', () => {
    gsap.set(element, { clearProps: 'all' })
  })
  tl.eventCallback('onInterrupt', () => {
    gsap.set(element, { clearProps: 'all' })
  })
  return tl
}

export const softBlurIn: AnimationFn = (element, options = {}) => {
  const { energy = ENERGY_NORMAL, duration = 0.9 } = options
  const tl = createTimeline(prefersReducedMotion())
  const blurAmount = scaleByEnergy(5, energy)

  tl.fromTo(element, { filter: `blur(${blurAmount}px)`, autoAlpha: 0 }, {
    filter: 'blur(0px)', autoAlpha: 1, duration, ease: 'power1.out',
  })
  tl.eventCallback('onComplete', () => {
    gsap.set(element, { clearProps: 'all' })
  })
  tl.eventCallback('onInterrupt', () => {
    gsap.set(element, { clearProps: 'all' })
  })
  return tl
}

// ==================== 力量动画集合 ====================
export const powerAnimations: AnimationFn[] = [
  powerSlideRight, powerSlideLeft, powerSlideTop, powerSlideBottom,
  powerFadeIn, powerWordByWord, powerScaleIn, powerBlurIn,
]

// ==================== 柔和动画集合 ====================
export const softAnimations: AnimationFn[] = [
  softSlideRight, softSlideLeft, softSlideTop, softSlideBottom,
  softFadeIn, softWordByWord, softScaleIn, softBlurIn,
]

// ==================== 动画名称映射 ====================

/**
 * 动画名称映射，用于调试和日志
 */
export const animationNames: Record<string, string> = {
  slideRight: '右侧滑入',
  slideLeft: '左侧滑入',
  slideTop: '上方滑入',
  slideBottom: '下方滑入',
  fadeIn: '淡入',
  wordByWord: '逐字淡入',
  scaleIn: '缩放进入',
  blurIn: '模糊进入',
  wordDrop: '砸落效果',
  wordVibrate: '颤抖效果',
  wordNormal: '普通淡入',
  exit: '退场',
}

export default {
  slideRight,
  slideLeft,
  slideTop,
  slideBottom,
  fadeIn,
  wordByWord,
  scaleIn,
  blurIn,
  wordDrop,
  wordVibrate,
  wordNormal,
  exit,
  normalAnimations,
  rhythmAnimations,
  powerAnimations,
  softAnimations,
  animationNames,
}
