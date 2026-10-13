/**
 * VHS 录像效果渲染器
 *
 * 模拟老旧 VHS 录像带的视觉特征，包含：
 * - 雪花噪点（Luma noise）：亮度随机波动，画面颗粒感
 * - 扫描线（Scanlines）：CRT 显示器水平扫描线
 * - 信号干扰（Signal interference）：偶发的水平条纹偏移
 * - 画面撕裂（Tracking error）：VHS 磁头跟踪不良导致的画面错位
 * - 滚动横条（Rolling bar）：垂直滚动的亮度条，模拟磁带速度不稳
 * - 色彩偏移（Color bleed）：RGB 通道水平偏移
 *
 * 架构说明：
 *   每帧从底色重新开始绘制，避免叠加效果（如 screen 模式）的亮度累积。
 *   putImageData 不受 globalCompositeOperation 影响，因此所有需要混合的
 *   效果（噪点、色彩偏移）都先绘制到离屏画布，再通过 drawImage + composite
 *   mode 叠加到目标画布。
 */

/** 底色：可以是静态字符串，也可以是每帧动态获取的 getter 函数 */
type BgColor = string | (() => string);

export interface VHSOptions {
  /** 总体强度 0-1，控制所有效果的可见度 */
  intensity?: number;
  /** 雪花噪点强度 0-1（默认 0.35） */
  snow?: number;
  /** 扫描线强度 0-1（默认 0.12） */
  scanlines?: number;
  /** 信号干扰频率 0-1（默认 0.15）—— 每帧出现干扰条纹的概率 */
  interference?: number;
  /** 色彩偏移像素数（默认 2） */
  colorBleed?: number;
  /** 滚动横条是否启用（默认 true） */
  rollingBar?: boolean;
  /** 帧率（默认 24fps，VHS 质感不需要太高） */
  fps?: number;
}

const DEFAULT_OPTIONS: Required<VHSOptions> = {
  intensity: 0.6,
  snow: 0.35,
  scanlines: 0.12,
  interference: 0.15,
  colorBleed: 2,
  rollingBar: true,
  fps: 24
};

/**
 * 启动 VHS 效果动画
 *
 * 该函数接管目标 canvas，每帧从底色重新渲染并叠加 VHS 效果。
 * 调用方无需预先绘制底色 —— 动画循环会自动处理。
 *
 * @param ctx 目标 canvas 的 2D 上下文
 * @param width 画布逻辑宽度（CSS 像素）
 * @param height 画布逻辑高度（CSS 像素）
 * @param bgColor 底色（每帧重新填充）。支持传入 getter 函数实现动态底色，
 *                避免在底色变化时频繁重启动画（如过渡阶段封面色变化）
 * @param options 效果配置
 * @returns 停止函数，调用后停止动画并清除画布
 */
export function startVHSAnimation(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bgColor: BgColor,
  options: VHSOptions = {}
): () => void {
  const opts: Required<VHSOptions> = { ...DEFAULT_OPTIONS, ...options };
  let running = true;

  // 每帧获取最新底色（支持动态值）
  const resolveBg = typeof bgColor === 'function' ? bgColor : () => bgColor;

  // 帧率控制
  const frameInterval = 1000 / opts.fps;
  let lastFrame = 0;

  // ==================== 离屏画布初始化 ====================
  // 噪点离屏画布（每帧重新填充 ImageData）
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = width;
  noiseCanvas.height = height;
  const noiseCtx = noiseCanvas.getContext('2d')!;
  const noiseImageData = noiseCtx.createImageData(width, height);

  // 工作画布（用于复制主画布内容做色彩偏移/干扰条纹）
  const workCanvas = document.createElement('canvas');
  workCanvas.width = width;
  workCanvas.height = height;
  const workCtx = workCanvas.getContext('2d')!;

  // 扫描线离屏画布（一次性生成，复用）
  const scanlineCanvas = document.createElement('canvas');
  scanlineCanvas.width = width;
  scanlineCanvas.height = height;
  const slCtx = scanlineCanvas.getContext('2d')!;
  for (let y = 0; y < height; y += 3) {
    slCtx.fillStyle = `rgba(0, 0, 0, ${opts.scanlines * opts.intensity})`;
    slCtx.fillRect(0, y, width, 1);
  }

  // ==================== 动画状态 ====================
  let rollPhase = 0;
  const rollSpeed = 0.004;

  let interferenceActive = false;
  let interferenceFramesLeft = 0;
  let interferenceY = 0;
  let interferenceHeight = 0;
  let interferenceShift = 0;

  /**
   * 绘制单帧 VHS 效果
   * 每帧从底色重新开始，避免叠加效果累积
   */
  function drawFrame() {
    if (!running) return;

    const masterIntensity = opts.intensity;
    const currentBg = resolveBg();

    // ==================== 0. 重置画布到底色 ====================
    // 先 clearRect 确保完全清除（即使 bgColor 无效也不会残留上帧内容），
    // 再用 source-over + 不透明底色 fillRect 覆盖。
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置 transform 到像素级，确保 clearRect 覆盖全画布
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (currentBg) {
      ctx.fillStyle = currentBg;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    ctx.restore(); // 恢复调用方的 transform（scale(dpr,dpr)）

    // ==================== 1. 雪花噪点 ====================
    // 填充噪点 ImageData 到离屏画布，然后通过 drawImage + overlay 混合
    const data = noiseImageData.data;
    const snowLevel = opts.snow * masterIntensity;

    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() < snowLevel) {
        const v = 120 + Math.random() * 135;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = Math.random() * 180 * masterIntensity;
      } else {
        data[i + 3] = 0;
      }
    }
    noiseCtx.putImageData(noiseImageData, 0, 0);

    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(noiseCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // ==================== 2. 色彩偏移（Color bleed）====================
    if (opts.colorBleed > 0) {
      const shift = opts.colorBleed;
      // 复制当前帧到工作画布
      workCtx.clearRect(0, 0, width, height);
      workCtx.drawImage(ctx.canvas, 0, 0, width, height);

      // 红色通道右偏移
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.3 * masterIntensity;
      ctx.drawImage(workCanvas, shift, 0);

      // 蓝色通道左偏移
      ctx.globalAlpha = 0.2 * masterIntensity;
      ctx.drawImage(workCanvas, -shift, 0);

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // ==================== 3. 信号干扰条纹 ====================
    if (!interferenceActive && Math.random() < opts.interference) {
      interferenceActive = true;
      interferenceFramesLeft = 3 + Math.floor(Math.random() * 8);
      interferenceY = Math.random() * (height - 40);
      interferenceHeight = 8 + Math.random() * 30;
      interferenceShift = (Math.random() - 0.5) * 30 * masterIntensity;
    }

    if (interferenceActive) {
      const y = Math.floor(interferenceY);
      const h = Math.ceil(interferenceHeight);
      if (y >= 0 && y + h <= height) {
        // 复制干扰区域到工作画布
        workCtx.clearRect(0, 0, width, height);
        workCtx.drawImage(ctx.canvas, 0, y, width, h, 0, y, width, h);
        // 清除原区域并偏移重绘
        ctx.clearRect(0, y, width, h);
        ctx.drawImage(workCanvas, 0, y, width, h, interferenceShift, y, width, h);

        // 干扰区域亮度增强
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * masterIntensity})`;
        ctx.fillRect(0, interferenceY, width, interferenceHeight);
        ctx.globalCompositeOperation = 'source-over';
      }

      interferenceFramesLeft--;
      if (interferenceFramesLeft <= 0) interferenceActive = false;
    }

    // ==================== 4. 滚动横条 ====================
    if (opts.rollingBar) {
      rollPhase += rollSpeed;
      if (rollPhase > 1.2) rollPhase = -0.2;

      const barY = rollPhase * height;
      const barHeight = height * 0.15;
      const gradient = ctx.createLinearGradient(0, barY, 0, barY + barHeight);
      const baseAlpha = 0.08 * masterIntensity;
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${baseAlpha})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = gradient;
      ctx.fillRect(0, barY, width, barHeight);
      ctx.globalCompositeOperation = 'source-over';
    }

    // ==================== 5. 扫描线 ====================
    ctx.drawImage(scanlineCanvas, 0, 0);

    // ==================== 6. 偶发画面抖动（Tracking jump）====================
    if (Math.random() < 0.02 * masterIntensity) {
      const jitter = Math.random() < 0.5 ? 1 : -1;
      workCtx.clearRect(0, 0, width, height);
      workCtx.drawImage(ctx.canvas, 0, 0, width, height);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(workCanvas, jitter, 0);
    }

    lastFrame = performance.now();
  }

  // 帧率限制的动画循环
  let rafId = 0;
  function loop(now: number) {
    if (!running) return;
    if (now - lastFrame >= frameInterval) {
      drawFrame();
    }
    rafId = requestAnimationFrame(loop);
  }

  drawFrame(); // 立即绘制第一帧
  rafId = requestAnimationFrame(loop);

  return () => {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    // 停止时清除画布，避免残留最后一帧的叠加效果
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  };
}
