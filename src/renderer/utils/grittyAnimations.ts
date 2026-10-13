/**
 * 粗粝模式 GSAP 动画预设 (Gritty Animations)
 *
 * 文字色块从屏幕边缘滑入/滑出的动画
 */

import gsap from 'gsap';

/**
 * 能量缩放
 *
 * @param value - 基础值
 * @param energy - 能量级别 (0.5-2.0)
 * @returns 缩放后的值
 */
function scaleByEnergy(value: number, energy: number = 1): number {
  return value * (0.8 + energy * 0.4);
}

/**
 * 判断元素应该从哪一侧滑入
 *
 * @param element - 目标元素
 * @returns 'left' | 'right'
 */
function getNearestEdge(element: HTMLElement): 'left' | 'right' {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const windowCenter = window.innerWidth / 2;

  return centerX < windowCenter ? 'left' : 'right';
}

/**
 * 色块滑入动画
 *
 * 从屏幕边缘滑入到目标位置
 *
 * @param el - 目标元素
 * @param fromEdge - 滑入方向 ('left' | 'right')
 * @param energy - 能量级别 (0.5-2.0)
 * @returns GSAP Timeline
 */
export function slideInBlock(
  el: HTMLElement,
  fromEdge: 'left' | 'right' = 'left',
  energy: number = 1
): gsap.core.Timeline {
  const tl = gsap.timeline();

  const distance = scaleByEnergy(100, energy);
  const duration = scaleByEnergy(0.6, energy);
  const startX = fromEdge === 'left' ? -distance : distance;

  // 设置初始状态
  gsap.set(el, {
    x: startX,
    opacity: 0,
    scale: 0.95,
  });

  // 滑入动画
  tl.to(el, {
    x: 0,
    opacity: 1,
    scale: 1,
    duration,
    ease: 'power2.out',
  });

  return tl;
}

/**
 * 色块滑出动画
 *
 * 滑出到原来的方向
 *
 * @param el - 目标元素
 * @param toEdge - 滑出方向 ('left' | 'right')
 * @param energy - 能量级别 (0.5-2.0)
 * @returns GSAP Timeline
 */
export function slideOutBlock(
  el: HTMLElement,
  toEdge: 'left' | 'right' = 'left',
  energy: number = 1
): gsap.core.Timeline {
  const tl = gsap.timeline();

  const distance = scaleByEnergy(100, energy);
  const duration = scaleByEnergy(0.4, energy);
  const endX = toEdge === 'left' ? -distance : distance;

  // 滑出动画
  tl.to(el, {
    x: endX,
    opacity: 0,
    scale: 0.95,
    duration,
    ease: 'power2.in',
  });

  return tl;
}

/**
 * 文字渐显动画
 *
 * @param el - 目标元素
 * @param delay - 延迟时间 (秒)
 * @returns GSAP Timeline
 */
export function fadeRevealText(
  el: HTMLElement,
  delay: number = 0
): gsap.core.Timeline {
  const tl = gsap.timeline();

  gsap.set(el, {
    opacity: 0,
    filter: 'blur(4px)',
  });

  tl.to(el, {
    opacity: 1,
    filter: 'blur(0px)',
    duration: 0.3,
    delay,
    ease: 'power1.out',
  });

  return tl;
}

/**
 * 词组依次滑入动画
 *
 * @param words - 词组元素数组
 * @param fromEdge - 滑入方向
 * @param stagger - 间隔时间 (秒)
 * @param energy - 能量级别
 * @returns GSAP Timeline
 */
export function staggerWords(
  words: HTMLElement[],
  fromEdge: 'left' | 'right' = 'left',
  stagger: number = 0.08,
  energy: number = 1
): gsap.core.Timeline {
  const tl = gsap.timeline();

  words.forEach((word, index) => {
    const delay = index * stagger;
    const wordTl = slideInBlock(word, fromEdge, energy);
    tl.add(wordTl, delay);
  });

  return tl;
}

/**
 * 文字抖动动画
 *
 * 用于狂躁模式的强调效果
 *
 * @param el - 目标元素
 * @param intensity - 抖动强度 (0-1)
 * @returns GSAP Timeline
 */
export function shakeText(
  el: HTMLElement,
  intensity: number = 0.5
): gsap.core.Timeline {
  const tl = gsap.timeline();
  const amplitude = intensity * 5;

  tl.to(el, {
    x: `random(-${amplitude}, ${amplitude})`,
    y: `random(-${amplitude * 0.5}, ${amplitude * 0.5})`,
    rotation: `random(-${intensity * 2}, ${intensity * 2})`,
    duration: 0.1,
    repeat: 3,
    yoyo: true,
    ease: 'power1.inOut',
  });

  return tl;
}

/**
 * 完整的歌词行切换动画
 *
 * 1. 旧行滑出
 * 2. 新行滑入
 * 3. 词组依次显示
 *
 * @param oldElement - 旧行元素
 * @param newElement - 新行元素
 * @param words - 新行的词组元素数组
 * @param energy - 能量级别
 * @returns GSAP Timeline
 */
export function lyricTransition(
  oldElement: HTMLElement | null,
  newElement: HTMLElement,
  words: HTMLElement[],
  energy: number = 1
): gsap.core.Timeline {
  const tl = gsap.timeline();

  // 判断新行应该从哪一侧滑入
  const fromEdge = getNearestEdge(newElement);

  // 旧行滑出
  if (oldElement) {
    const oldEdge = fromEdge === 'left' ? 'right' : 'left';
    tl.add(slideOutBlock(oldElement, oldEdge, energy), 0);
  }

  // 新行滑入
  tl.add(slideInBlock(newElement, fromEdge, energy), oldElement ? 0.1 : 0);

  // 词组依次显示
  if (words.length > 0) {
    tl.add(staggerWords(words, fromEdge, 0.08, energy), 0.2);
  }

  return tl;
}
