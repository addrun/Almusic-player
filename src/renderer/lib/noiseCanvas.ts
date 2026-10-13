/**
 * 噪点 Canvas 工具
 *
 * 生成随机黑白噪点，用于诡谲模式前奏背景
 */

/**
 * 在指定 canvas 上绘制随机噪点
 *
 * @param ctx Canvas 2D 上下文
 * @param width 画布宽度
 * @param height 画布高度
 * @param intensity 噪点强度 0-1（越高噪点越密越亮）
 * @param color 噪点颜色，默认黑色
 */
export function drawNoise(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number = 0.5,
  color: string = '#000000'
): void {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const density = intensity * 255;

  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.random() * density;
    data[i] = 0;     // R
    data[i + 1] = 0; // G
    data[i + 2] = 0; // B
    // alpha 通道：随机决定是否绘制噪点
    data[i + 3] = Math.random() < intensity ? noise : 0;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * 生成噪点帧并持续更新（用于动画效果）
 *
 * @param ctx Canvas 2D 上下文
 * @param width 画布宽度
 * @param height 画布高度
 * @param intensity 噪点强度
 * @param fps 帧率，默认 15fps（噪点不需要太高帧率）
 * @returns 停止函数
 */
export function startNoiseAnimation(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number = 0.3,
  fps: number = 15
): () => void {
  let running = true;
  const interval = 1000 / fps;

  function frame() {
    if (!running) return;
    drawNoise(ctx, width, height, intensity);
  }

  const timer = setInterval(frame, interval);
  frame(); // 立即绘制第一帧

  return () => {
    running = false;
    clearInterval(timer);
  };
}
