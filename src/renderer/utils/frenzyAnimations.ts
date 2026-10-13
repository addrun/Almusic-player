/**
 * 狂躁模式 GSAP 动画预设 (Frenzy Animations)
 *
 * 文字弹入、抖动、叠加等极端动态效果
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
 * 红字弹入动画
 *
 * 从随机方向弹入到目标位置
 *
 * @param el - 目标元素
 * @param energy - 能量级别 (0.5-2.0)
 * @returns GSAP Timeline
 */
export function redWordBounce(
  el: HTMLElement,
  energy: number = 1
): gsap.core.Timeline {
  const tl = gsap.timeline();

  const directions = [
    { x: -50, y: 0 },
    { x: 50, y: 0 },
    { x: 0, y: -30 },
    { x: 0, y: 30 },
  ];

  const dir = directions[Math.floor(Math.random() * directions.length)];
  const duration = scaleByEnergy(0.4, energy);

  // 设置初始状态
  gsap.set(el, {
    x: dir.x,
    y: dir.y,
    opacity: 0,
    scale: scaleByEnergy(1.5, energy),
    rotation: (Math.random() - 0.5) * 10,
  });

  // 弹入动画
  tl.to(el, {
    x: 0,
    y: 0,
    opacity: 1,
    scale: 1,
    rotation: 0,
    duration,
    ease: 'elastic.out(1, 0.4)',
  });

  return tl;
}

/**
 * 红字抖动动画
 *
 * 持续抖动效果
 *
 * @param el - 目标元素
 * @param intensity - 抖动强度 (0-1)
 * @returns GSAP Timeline
 */
export function redWordShake(
  el: HTMLElement,
  intensity: number = 0.5
): gsap.core.Timeline {
  const tl = gsap.timeline();
  const amplitude = intensity * 8;

  tl.to(el, {
    x: `random(-${amplitude}, ${amplitude})`,
    y: `random(-${amplitude * 0.5}, ${amplitude * 0.5})`,
    rotation: `random(-${intensity * 3}, ${intensity * 3})`,
    duration: 0.08,
    repeat: -1,
    yoyo: true,
    ease: 'power1.inOut',
  });

  return tl;
}

/**
 * 黑字淡入动画
 *
 * @param el - 目标元素
 * @param delay - 延迟时间 (秒)
 * @returns GSAP Timeline
 */
export function blackTextFadeIn(
  el: HTMLElement,
  delay: number = 0
): gsap.core.Timeline {
  const tl = gsap.timeline();

  gsap.set(el, {
    opacity: 0,
    y: 10,
  });

  tl.to(el, {
    opacity: 1,
    y: 0,
    duration: 0.3,
    delay,
    ease: 'power1.out',
  });

  return tl;
}

/**
 * 文字故障效果
 *
 * 模拟 GLitch 故障的文字抖动
 *
 * @param el - 目标元素
 * @param duration - 持续时间 (秒)
 * @returns GSAP Timeline
 */
export function textGlitch(
  el: HTMLElement,
  duration: number = 0.3
): gsap.core.Timeline {
  const tl = gsap.timeline();

  // RGB 通道偏移模拟
  tl.to(el, {
    textShadow: '2px 0 #ff0000, -2px 0 #00ff00',
    duration: 0.05,
    repeat: Math.floor(duration / 0.1),
    yoyo: true,
    ease: 'none',
  });

  // 随机位移
  tl.to(el, {
    x: `random(-5, 5)`,
    duration: 0.05,
    repeat: Math.floor(duration / 0.1),
    yoyo: true,
    ease: 'none',
  }, 0);

  return tl;
}

/**
 * 完整的狂躁模式歌词切换动画
 *
 * 1. 旧行故障效果
 * 2. 新行黑字淡入
 * 3. 红字弹入叠加
 *
 * @param oldElement - 旧行元素
 * @param newElement - 新行元素
 * @param redWords - 红字元素数组
 * @param energy - 能量级别
 * @returns GSAP Timeline
 */
export function frenzyLyricTransition(
  oldElement: HTMLElement | null,
  newElement: HTMLElement,
  redWords: HTMLElement[],
  energy: number = 1
): gsap.core.Timeline {
  const tl = gsap.timeline();

  // 旧行故障效果
  if (oldElement) {
    tl.add(textGlitch(oldElement, 0.2), 0);
    tl.to(oldElement, {
      opacity: 0,
      duration: 0.2,
      ease: 'power2.in',
    }, 0);
  }

  // 新行黑字淡入
  const blackText = newElement.querySelector('.frenzy-lyrics__black-text') as HTMLElement;
  if (blackText) {
    tl.add(blackTextFadeIn(blackText, 0), oldElement ? 0.1 : 0);
  }

  // 红字弹入叠加
  redWords.forEach((word, index) => {
    const delay = 0.2 + index * 0.1;
    tl.add(redWordBounce(word, energy), delay);
  });

  return tl;
}
