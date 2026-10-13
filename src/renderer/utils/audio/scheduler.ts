/**
 * AudioScheduler — 基于 AudioContext.currentTime 的精准事件调度器
 *
 * 不使用 setInterval/setTimeout（存在抖动），而是利用 requestAnimationFrame
 * 轮询检查 AudioContext.currentTime，精度 ±16ms（一帧）。
 *
 * 用途：
 *   - 调度 crossfade 开始时间点（如乐句边界）
 *   - 调度 crossfade 结束后的 slot swap
 *   - 调度歌曲结束前 N 秒触发预加载
 */

export interface ScheduledEvent {
  id: number;
  time: number;        // AudioContext.currentTime 时间点
  callback: () => void;
  label?: string;      // 调试标签
}

class AudioScheduler {
  private ctx: AudioContext;
  private events: Map<number, ScheduledEvent> = new Map();
  private nextId = 0;
  private rafId: number | null = null;
  private running = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  /** 启动调度器 */
  start() {
    if (this.running) return;
    this.running = true;
    this.tick();
  }

  /** 停止调度器 */
  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * 在指定时间点调度回调
   * @param when AudioContext.currentTime 时间点
   * @param callback 回调函数
   * @param label 调试标签（可选）
   * @returns 事件 ID，可用于取消
   */
  scheduleAt(when: number, callback: () => void, label?: string): number {
    const id = this.nextId++;
    this.events.set(id, { id, time: when, callback, label });
    if (this.running && this.rafId === null) {
      this.tick();
    }
    return id;
  }

  /** 取消已调度的事件 */
  cancel(id: number): void {
    this.events.delete(id);
  }

  /** 取消所有事件 */
  cancelAll(): void {
    this.events.clear();
  }

  /** 获取待执行事件数量 */
  get pendingCount(): number {
    return this.events.size;
  }

  /** 获取所有待执行事件（调试用） */
  getPendingEvents(): ScheduledEvent[] {
    return [...this.events.values()].sort((a, b) => a.time - b.time);
  }

  /** rAF 轮询 */
  private tick = () => {
    if (!this.running) return;

    const now = this.ctx.currentTime;
    const triggered: number[] = [];

    for (const [id, event] of this.events) {
      if (now >= event.time) {
        try {
          event.callback();
        } catch (e) {
          console.error('[AudioScheduler] 事件回调执行错误:', e);
        }
        triggered.push(id);
      }
    }

    for (const id of triggered) {
      this.events.delete(id);
    }

    if (this.events.size > 0) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.rafId = null;
    }
  };
}

export { AudioScheduler };
