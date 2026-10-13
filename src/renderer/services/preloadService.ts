import { Howl } from 'howler';

import type { SongResult } from '@/types/music';

class PreloadService {
  private loadingPromises = new Map<
    string | number,
    { url: string; promise: Promise<Howl>; controller: AbortController }
  >();
  private preloadedSounds = new Map<string | number, { url: string; sound: Howl }>();

  /**
   * 加载并验证音频
   * 如果已经在加载中，返回现有的 Promise
   * 如果已经加载完成，返回缓存的 Howl 实例
   */
  public async load(song: SongResult): Promise<Howl> {
    if (!song || !song.id) {
      throw new Error('无效的歌曲对象');
    }

    // 1. 检查是否有正在进行的加载
    const pending = this.loadingPromises.get(song.id);
    if (pending && pending.url === song.playMusicUrl) return pending.promise;
    if (pending) this.cancel(song.id);

    // 2. 检查是否有已完成的缓存
    if (this.preloadedSounds.has(song.id)) {
      const cached = this.preloadedSounds.get(song.id)!;
      const sound = cached.sound;
      // 检查 URL 是否变化（本地歌曲可能重新编码 URL）
      if (cached.url === song.playMusicUrl && sound.state() === 'loaded') {
        return sound;
      } else {
        // 如果缓存的音频状态不正常，清理并重新加载
        this.preloadedSounds.delete(song.id);
        sound.unload();
      }
    }

    // 3. 开始新的加载过程
    const controller = new AbortController();
    const url = song.playMusicUrl || '';
    const loadPromise = this._performLoad({ ...song, playMusicUrl: url }, controller.signal);
    const entry = { url, promise: loadPromise, controller };
    this.loadingPromises.set(song.id, entry);

    try {
      const sound = await loadPromise;
      if (controller.signal.aborted || this.loadingPromises.get(song.id) !== entry) {
        sound.unload();
        throw new Error('预加载已取消');
      }
      this.preloadedSounds.set(song.id, { url, sound });
      return sound;
    } finally {
      if (this.loadingPromises.get(song.id) === entry) this.loadingPromises.delete(song.id);
    }
  }

  /**
   * 执行实际的加载和验证逻辑
   */
  private async _performLoad(song: SongResult, signal: AbortSignal): Promise<Howl> {
    if (!song.playMusicUrl) {
      throw new Error('歌曲没有 URL');
    }

    // 创建初始音频实例
    const sound = await this._createSound(song.playMusicUrl, song.kugou ? 12000 : 0, signal);

    // 检查时长
    const duration = sound.duration();
    const expectedDuration = (song.dt || 0) / 1000;

    if (expectedDuration > 0 && duration > 0) {
      const durationDiff = Math.abs(duration - expectedDuration);
      // 如果实际时长远小于预期（可能是试听版），记录警告
      if (duration < expectedDuration * 0.5 && durationDiff > 10) {
        console.warn(
          `[PreloadService] 时长严重不足：实际 ${duration.toFixed(1)}s, 预期 ${expectedDuration.toFixed(1)}s (${song.name})，可能是试听版`
        );
        // 通过自定义事件通知上层，可用于后续自动切换音源
        window.dispatchEvent(
          new CustomEvent('audio-duration-mismatch', {
            detail: {
              songId: song.id,
              songName: song.name,
              actualDuration: duration,
              expectedDuration
            }
          })
        );
      } else if (durationDiff > 5) {
        console.warn(
          `[PreloadService] 时长差异警告：实际 ${duration.toFixed(1)}s, 预期 ${expectedDuration.toFixed(1)}s (${song.name})`
        );
      }
    }

    return sound;
  }

  private _createSound(url: string, timeoutMs = 0, signal?: AbortSignal): Promise<Howl> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        sound.unload();
        reject(error);
      };
      const onAbort = () => fail(new Error('预加载已取消'));
      const sound = new Howl({
        src: [url],
        html5: true,
        preload: true,
        autoplay: false,
        onload: () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(sound);
        },
        onloaderror: (_, err) => fail(err)
      });
      if (!settled && timeoutMs > 0)
        timer = setTimeout(() => fail(new Error('酷狗音频加载超时')), timeoutMs);
      if (!settled) signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  }

  /**
   * 取消特定歌曲的预加载，终止加载中的音频并防止旧结果回填。
   */
  public cancel(songId: string | number) {
    const pending = this.loadingPromises.get(songId);
    if (pending) {
      this.loadingPromises.delete(songId);
      pending.controller.abort();
    }
    if (this.preloadedSounds.has(songId)) {
      const sound = this.preloadedSounds.get(songId)!.sound;
      sound.unload();
      this.preloadedSounds.delete(songId);
    }
  }

  /**
   * 获取已预加载的音频实例（如果存在）
   */
  public getPreloadedSound(songId: string | number): Howl | undefined {
    return this.preloadedSounds.get(songId)?.sound;
  }

  /**
   * 消耗（使用）已预加载的音频
   * 从缓存中移除但不 unload（由调用方管理生命周期）
   * @returns 预加载的 Howl 实例，如果没有则返回 undefined
   */
  public consume(songId: string | number, url?: string): Howl | undefined {
    const cached = this.preloadedSounds.get(songId);
    if (cached) {
      this.preloadedSounds.delete(songId);
      if (url && cached.url !== url) {
        cached.sound.unload();
        return undefined;
      }
      return cached.sound;
    }
    return undefined;
  }

  /**
   * 清理所有预加载资源
   */
  public clearAll() {
    for (const id of [...this.loadingPromises.keys()]) this.cancel(id);
    this.preloadedSounds.forEach(({ sound }) => sound.unload());
    this.preloadedSounds.clear();
    this.loadingPromises.clear();
  }
}

export const preloadService = new PreloadService();
