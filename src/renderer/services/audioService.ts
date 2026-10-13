import { Howl, Howler } from 'howler';

import { isLocalSong } from '@/hooks/useLocalMusic';
import type { AudioOutputDevice } from '@/types/audio';
import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';

import { climaxDetector } from './climaxDetector';
import { drumDetector } from './drumDetector';
import { LocalAudioPlayer } from './localAudioPlayer';

class AudioService {
  private currentSound: Howl | LocalAudioPlayer | null = null;
  private pendingSound: Howl | LocalAudioPlayer | null = null;

  private currentTrack: SongResult | null = null;

  private context: AudioContext | null = null;

  private filters: BiquadFilterNode[] = [];

  private source: MediaElementAudioSourceNode | null = null;

  private gainNode: GainNode | null = null;

  private bypass = false;

  private playbackRate = 1.0; // 添加播放速度属性

  private currentSinkId: string = 'default';

  private contextStateMonitoringInitialized = false;

  // 预设的 EQ 频段
  private readonly frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  // 默认的 EQ 设置
  private defaultEQSettings: { [key: string]: number } = {
    '31': 0,
    '62': 0,
    '125': 0,
    '250': 0,
    '500': 0,
    '1000': 0,
    '2000': 0,
    '4000': 0,
    '8000': 0,
    '16000': 0
  };

  private retryCount = 0;

  private seekLock = false;

  private seekDebounceTimer: NodeJS.Timeout | null = null;

  // 添加操作锁防止并发操作
  private operationLock = false;
  private operationLockTimer: NodeJS.Timeout | null = null;
  private operationLockTimeout = 5000; // 5秒超时
  private operationLockStartTime: number = 0;
  private operationLockId: string = '';

  // ==================== 智能混音状态 ====================
  private crossfadingSound: Howl | LocalAudioPlayer | null = null;
  private crossfadeGain: GainNode | null = null;
  private crossfadeCleanupTimeout: number | null = null;

  constructor() {
    if ('mediaSession' in navigator) {
      this.initMediaSession();
    }
    // 从本地存储加载 EQ 开关状态
    const bypassState = localStorage.getItem('eqBypass');
    this.bypass = bypassState ? JSON.parse(bypassState) : false;

    // 页面加载时立即强制重置操作锁
    this.forceResetOperationLock();

    // 添加页面卸载事件，确保离开页面时清除锁
    window.addEventListener('beforeunload', () => {
      this.forceResetOperationLock();
    });
  }

  private initMediaSession() {
    navigator.mediaSession.setActionHandler('play', () => {
      this.currentSound?.play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.currentSound?.pause();
    });

    navigator.mediaSession.setActionHandler('stop', () => {
      this.stop();
    });

    navigator.mediaSession.setActionHandler('seekto', (event) => {
      if (event.seekTime && this.currentSound) {
        // this.currentSound.seek(event.seekTime);
        this.seek(event.seekTime);
      }
    });

    navigator.mediaSession.setActionHandler('seekbackward', (event) => {
      if (this.currentSound) {
        const currentTime = this.currentSound.seek() as number;
        this.seek(currentTime - (event.seekOffset || 10));
      }
    });

    navigator.mediaSession.setActionHandler('seekforward', (event) => {
      if (this.currentSound) {
        const currentTime = this.currentSound.seek() as number;
        this.seek(currentTime + (event.seekOffset || 10));
      }
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      // 这里需要通过回调通知外部
      this.emit('previoustrack');
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      // 这里需要通过回调通知外部
      this.emit('nexttrack');
    });
  }

  private updateMediaSessionMetadata(track: SongResult) {
    try {
      if (!('mediaSession' in navigator)) return;

      const artists = track.ar
        ? track.ar.map((a) => a.name)
        : track.song.artists?.map((a) => a.name);
      const album = track.al ? track.al.name : track.song.album.name;
      const artwork = ['96', '128', '192', '256', '384', '512'].map((size) => ({
        src: `${track.picUrl?.replace(/^http:/, 'https:')}?param=${size}y${size}`,
        type: 'image/jpg',
        sizes: `${size}x${size}`
      }));
      const metadata = {
        title: track.name || '',
        artist: artists ? artists.join(',') : '',
        album: album || '',
        artwork
      };

      navigator.mediaSession.metadata = new window.MediaMetadata(metadata);
    } catch (error) {
      console.error('更新媒体会话元数据时出错:', error);
    }
  }

  private updateMediaSessionState(isPlaying: boolean) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    this.updateMediaSessionPositionState();
  }

  private updateMediaSessionPositionState() {
    try {
      if (!this.currentSound || !('mediaSession' in navigator)) return;
      if ('setPositionState' in navigator.mediaSession) {
        navigator.mediaSession.setPositionState({
          duration: this.currentSound.duration(),
          playbackRate: this.playbackRate,
          position: this.currentSound.seek() as number
        });
      }
    } catch (error) {
      console.error('更新媒体会话位置状态时出错:', error);
    }
  }

  // 事件处理相关
  private callbacks: { [key: string]: Function[] } = {};

  private emit(event: string, ...args: any[]) {
    const eventCallbacks = this.callbacks[event];
    if (eventCallbacks) {
      eventCallbacks.forEach((callback) => callback(...args));
    }
  }

  on(event: string, callback: Function) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  off(event: string, callback: Function) {
    const eventCallbacks = this.callbacks[event];
    if (eventCallbacks) {
      this.callbacks[event] = eventCallbacks.filter((cb) => cb !== callback);
    }
  }

  // EQ 相关方法
  public isEQEnabled(): boolean {
    return !this.bypass;
  }

  public setEQEnabled(enabled: boolean) {
    this.bypass = !enabled;
    localStorage.setItem('eqBypass', JSON.stringify(this.bypass));

    if (this.source && this.gainNode && this.context) {
      this.applyBypassState();
    }
  }

  public setEQFrequencyGain(frequency: string, gain: number) {
    const filterIndex = this.frequencies.findIndex((f) => f.toString() === frequency);
    if (filterIndex !== -1 && this.filters[filterIndex]) {
      this.filters[filterIndex].gain.setValueAtTime(gain, this.context?.currentTime || 0);
      this.saveEQSettings(frequency, gain);
    }
  }

  public resetEQ() {
    this.filters.forEach((filter) => {
      filter.gain.setValueAtTime(0, this.context?.currentTime || 0);
    });
    localStorage.removeItem('eqSettings');
  }

  public getAllEQSettings(): { [key: string]: number } {
    return this.loadEQSettings();
  }

  private saveEQSettings(frequency: string, gain: number) {
    const settings = this.loadEQSettings();
    settings[frequency] = gain;
    localStorage.setItem('eqSettings', JSON.stringify(settings));
  }

  private loadEQSettings(): { [key: string]: number } {
    const savedSettings = localStorage.getItem('eqSettings');
    return savedSettings ? JSON.parse(savedSettings) : { ...this.defaultEQSettings };
  }

  private async disposeEQ(keepContext = false) {
    try {
      // 断开高潮检测器和鼓点检测器
      climaxDetector.disconnect();
      drumDetector.disconnect();

      // 清理音频节点连接（不切断 LocalAudioPlayer 的 inputNode，它由播放器自己管理）
      if (this.source && !(this.currentSound instanceof LocalAudioPlayer)) {
        this.source.disconnect();
      }
      this.source = null;

      // 清理滤波器
      this.filters.forEach((filter) => {
        try {
          filter.disconnect();
        } catch (e) {
          console.warn('清理滤波器时出错:', e);
        }
      });
      this.filters = [];

      // 清理增益节点
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }

      // 如果不需要保持上下文，则关闭它
      if (!keepContext && this.context) {
        try {
          await this.context.close();
          this.context = null;
        } catch (e) {
          console.warn('关闭音频上下文时出错:', e);
        }
      }
    } catch (error) {
      console.error('清理EQ资源时出错:', error);
    }
  }

  private async setupEQ(sound: Howl | LocalAudioPlayer) {
    try {
      if (!isElectron) {
        this.bypass = true;
        return;
      }

      // 清理现有连接
      await this.disposeEQ(true);

      // LocalAudioPlayer: 走专用分支
      if (sound instanceof LocalAudioPlayer) {
        return this._setupEQLocal(sound);
      }

      // Howl: 走原有路径
      const howl = sound as any;
      const audioNode = howl._sounds?.[0]?._node;

      if (!audioNode || !(audioNode instanceof HTMLMediaElement)) {
        if (this.retryCount < 3) {
          console.warn('等待音频节点初始化，重试次数:', this.retryCount + 1);
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.retryCount++;
          return await this.setupEQ(sound);
        }
        throw new Error('无法获取音频节点，请重试');
      }

      this.retryCount = 0;

      // 确保使用 Howler 的音频上下文
      this.context = Howler.ctx as AudioContext;

      if (!this.context || this.context.state === 'closed') {
        Howler.ctx = new AudioContext();
        this.context = Howler.ctx;
        Howler.masterGain = this.context.createGain();
        Howler.masterGain.connect(this.context.destination);
      }

      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      // 设置 AudioContext 状态监控
      this.setupContextStateMonitoring();

      // 恢复保存的音频输出设备
      this.restoreSavedAudioDevice();

      // 清理现有连接
      await this.disposeEQ(true);

      try {
        // 检查节点是否已经有源
        const existingSource = (audioNode as any).source as MediaElementAudioSourceNode;
        if (existingSource?.context === this.context) {
          this.source = existingSource;
        } else {
          // 创建新的源节点
          this.source = this.context.createMediaElementSource(audioNode);
          (audioNode as any).source = this.source;
        }
      } catch (e) {
        console.error('创建音频源节点失败:', e);
        throw e;
      }

      // 创建增益节点
      this.gainNode = this.context.createGain();

      // 创建滤波器
      this.filters = this.frequencies.map((freq) => {
        const filter = this.context!.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1;
        filter.gain.value = this.loadEQSettings()[freq.toString()] || 0;
        return filter;
      });

      // 连接高潮检测器和鼓点检测器（连接到 gainNode，不受 applyBypassState 断连影响）
      climaxDetector.connect(this.context, this.gainNode);
      drumDetector.connect(this.context, this.gainNode);

      // 启动检测器（idempotent，styleEngine 也会调用）
      drumDetector.start();
      climaxDetector.start();

      // 应用EQ状态
      this.applyBypassState();

      // 从 localStorage 应用音量到增益节点
      const savedVolume = localStorage.getItem('volume');
      if (savedVolume) {
        this.applyVolume(parseFloat(savedVolume));
      } else {
        this.applyVolume(1);
      }

    } catch (error) {
      console.error('EQ initialization failed:', error);
      await this.disposeEQ();
      throw error;
    }
  }

  private _setupEQLocal(sound: LocalAudioPlayer) {
    this.context = Howler.ctx as AudioContext;
    if (!this.context || this.context.state === 'closed') {
      Howler.ctx = new AudioContext();
      this.context = Howler.ctx;
      Howler.masterGain = this.context.createGain();
      Howler.masterGain.connect(this.context.destination);
    }

    this.setupContextStateMonitoring();
    this.restoreSavedAudioDevice();

    this.source = sound.getInputNode() as any;

    this.gainNode = this.context.createGain();

    this.filters = this.frequencies.map((freq) => {
      const filter = this.context!.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = this.loadEQSettings()[freq.toString()] || 0;
      return filter;
    });

    climaxDetector.connect(this.context, this.gainNode);
    drumDetector.connect(this.context, this.gainNode);

    drumDetector.start();
    climaxDetector.start();

    this.applyBypassState();

    const savedVolume = localStorage.getItem('volume');
    if (savedVolume) {
      this.applyVolume(parseFloat(savedVolume));
    } else {
      this.applyVolume(1);
    }

  }

  private applyBypassState() {
    if (!this.source || !this.gainNode || !this.context) return;

    try {
      // 断开所有现有连接（捕获已断开的错误）
      try {
        this.source.disconnect();
      } catch {
        /* already disconnected */
      }
      this.filters.forEach((filter) => {
        try {
          filter.disconnect();
        } catch {
          /* already disconnected */
        }
      });
      try {
        this.gainNode.disconnect();
      } catch {
        /* already disconnected */
      }

      if (this.bypass) {
        // EQ被禁用时，直接连接到输出
        this.source.connect(this.gainNode);
        this.gainNode.connect(this.context.destination);
      } else {
        // EQ启用时，通过滤波器链连接
        this.source.connect(this.filters[0]);
        this.filters.forEach((filter, index) => {
          if (index < this.filters.length - 1) {
            filter.connect(this.filters[index + 1]);
          }
        });
        this.filters[this.filters.length - 1].connect(this.gainNode);
        this.gainNode.connect(this.context.destination);
      }

      // 重连检测器到 gainNode（gainNode.disconnect() 会断开所有输出）
      try { climaxDetector.disconnect(); } catch {}
      try { drumDetector.disconnect(); } catch {}
      climaxDetector.connect(this.context, this.gainNode);
      drumDetector.connect(this.context, this.gainNode);
      drumDetector.start();
      climaxDetector.start();
    } catch (error) {
      console.error('Error applying EQ state, attempting fallback:', error);
      // Fallback: connect source directly to destination
      try {
        if (this.source && this.context) {
          this.source.connect(this.context.destination);
        }
      } catch (fallbackError) {
        console.error('Fallback connection also failed:', fallbackError);
        this.emit('audio_error', { type: 'graph_disconnected', error: fallbackError });
      }
    }
  }

  // 设置操作锁，带超时自动释放
  private setOperationLock(): boolean {
    // 生成唯一的锁ID
    const lockId = Date.now().toString() + Math.random().toString(36).substring(2, 9);

    // 如果锁已经存在，检查是否超时
    if (this.operationLock) {
      const currentTime = Date.now();
      const lockDuration = currentTime - this.operationLockStartTime;

      // 如果锁持续时间超过2秒，直接强制重置
      if (lockDuration > 2000) {
        console.warn(`操作锁已激活 ${lockDuration}ms，超过安全阈值，强制重置`);
        this.forceResetOperationLock();
      } else {
        return false;
      }
    }

    this.operationLock = true;
    this.operationLockStartTime = Date.now();
    this.operationLockId = lockId;

    // 将锁信息存储到 localStorage（仅用于调试，实际不依赖此值）
    try {
      localStorage.setItem(
        'audioOperationLock',
        JSON.stringify({
          id: this.operationLockId,
          startTime: this.operationLockStartTime
        })
      );
    } catch (error) {
      console.error('存储操作锁信息失败:', error);
    }

    // 清除之前的定时器
    if (this.operationLockTimer) {
      clearTimeout(this.operationLockTimer);
    }

    // 设置超时自动释放锁
    this.operationLockTimer = setTimeout(() => {
      console.warn('操作锁超时自动释放');
      this.releaseOperationLock();
    }, this.operationLockTimeout);

    return true;
  }

  // 释放操作锁
  public releaseOperationLock(): void {
    this.operationLock = false;
    this.operationLockStartTime = 0;

    // 从 localStorage 中移除锁信息
    try {
      localStorage.removeItem('audioOperationLock');
    } catch (error) {
      console.error('清除存储的操作锁信息失败:', error);
    }

    if (this.operationLockTimer) {
      clearTimeout(this.operationLockTimer);
      this.operationLockTimer = null;
    }
  }

  // 强制重置操作锁，用于特殊情况
  public forceResetOperationLock(): void {
    this.operationLock = false;
    this.operationLockStartTime = 0;
    this.operationLockId = '';

    if (this.operationLockTimer) {
      clearTimeout(this.operationLockTimer);
      this.operationLockTimer = null;
    }

    // 清除存储的锁
    localStorage.removeItem('audioOperationLock');
  }

  // ==================== 智能混音 ====================

  /** 取消正在进行的 crossfade */
  private cancelCrossfade(): void {
    if (this.crossfadingSound) {
      try { this.crossfadingSound.stop(); this.crossfadingSound.unload(); } catch {}
      this.crossfadingSound = null;
    }
    if (this.crossfadeGain) {
      try { this.crossfadeGain.disconnect(); } catch {}
      this.crossfadeGain = null;
    }
    if (this.crossfadeCleanupTimeout) {
      clearTimeout(this.crossfadeCleanupTimeout);
      this.crossfadeCleanupTimeout = null;
    }
    // 恢复 gainNode 的音量（取消 crossfade 的淡出曲线）
    if (this.gainNode && this.context) {
      try {
        this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
        const vol = parseFloat(localStorage.getItem('volume') || '1');
        this.gainNode.gain.setValueAtTime(vol, this.context.currentTime);
      } catch {}
    }
    this.emit('crossfade-cancelled');
  }

  /** 是否正在 crossfade */
  public isCrossfading(): boolean {
    return this.crossfadingSound !== null;
  }

  /**
   * 智能混音 crossfade —— 在当前歌曲结束前预加载下一首并平滑过渡
   *
   * 本方法负责音频图拓扑（创建 crossfadeGain、连接 source、清理旧实例），
   * 曲线策略委托给 useSmartAudio 的三级策略（等功率 / 节拍对齐 / 频域拼接）。
   *
   * @param nextSound 下一首的音频实例（已加载）
   * @param nextTrack 下一首的 track 信息
   * @param duration 过渡时长（秒）
   * @param level 过渡等级 (1=等功率, 2=节拍对齐, 3=频域拼接)
   * @returns 是否成功启动 crossfade
   */
  public async crossfadeToNext(
    nextSound: Howl | LocalAudioPlayer,
    nextTrack: SongResult,
    duration: number,
    level: 1 | 2 | 3
  ): Promise<boolean> {
    const ctx = this.context;
    if (!ctx || !this.currentSound || !this.gainNode) return false;

    // 1. 确保下一首已加载
    if (nextSound instanceof LocalAudioPlayer) {
      try { await nextSound.load(); } catch { return false; }
    } else if (nextSound.state() !== 'loaded') {
      try {
        await new Promise<void>((resolve, reject) => {
          (nextSound as Howl).once('load', () => resolve());
          (nextSound as Howl).once('loaderror', () => reject(new Error('load error')));
        });
      } catch { return false; }
    }

    // 2. 为新歌曲创建独立的 gain 节点
    this.crossfadeGain = ctx.createGain();
    this.crossfadeGain.gain.value = 0;
    this.crossfadeGain.connect(ctx.destination);

    // 3. 获取新歌曲的 source 节点
    let nextSource: AudioNode;
    if (nextSound instanceof LocalAudioPlayer) {
      nextSource = nextSound.getInputNode();
    } else {
      const howl = nextSound as any;
      const audioNode = howl._sounds?.[0]?._node;
      if (!audioNode || !(audioNode instanceof HTMLMediaElement)) {
        try { this.crossfadeGain.disconnect(); } catch {}
        this.crossfadeGain = null;
        return false;
      }
      const existing = (audioNode as any).source as MediaElementAudioSourceNode;
      if (existing?.context === ctx) {
        nextSource = existing;
      } else {
        nextSource = ctx.createMediaElementSource(audioNode);
        (audioNode as any).source = nextSource;
      }
    }

    // 4. 连接: nextSource → crossfadeGain → destination
    nextSource.connect(this.crossfadeGain);

    // 5. 保存引用并设置事件监听
    this.crossfadingSound = nextSound;
    this.setupSoundEvents(nextSound);

    // 6. 开始播放新歌曲
    nextSound.play();

    // 7. 委托智能引擎应用 crossfade 曲线（三级策略）
    const now = ctx.currentTime;
    const savedVolume = parseFloat(localStorage.getItem('volume') || '1');

    // 当前歌曲的播放位置 / 剩余时间（Level 2 节拍对齐需要）
    let currentTime = 0;
    let songDuration = 0;
    try {
      currentTime = (this.currentSound.seek() as number) || 0;
      songDuration = (this.currentSound.duration() as number) || 0;
    } catch { /* 位置/时长读取失败，使用默认 0 */ }

    const remainingTime = songDuration > 0 ? Math.max(0, songDuration - currentTime) : duration;

    let actualDuration = duration;
    let usedLevel: 1 | 2 | 3 = level;

    // 延迟导入避免循环依赖
    try {
      const { getSmartAudio } = await import('@/composables/useSmartAudio');
      const smartAudio = getSmartAudio();
      if (smartAudio) {
        const result = smartAudio.crossfadeTo({
          gainOut: this.gainNode,
          gainIn: this.crossfadeGain,
          masterGain: this.getMasterGain() ?? (ctx as any).destination,
          duration,
          level,
          currentTime,
          remainingTime,
          nextTrackId: String(nextTrack.id),
          volume: savedVolume
        });
        actualDuration = result.duration;
        usedLevel = result.level;

        // Level 1/2 没有调度清理，需在过渡结束复位 isTransitioning
        if (usedLevel !== 3) {
          smartAudio.scheduleTransitionEnd(actualDuration);
        }
      } else {
        // 引擎未挂载：回退到内置等功率曲线
        this.applyEqualPowerFallback(savedVolume, duration);
      }
    } catch (e) {
      console.warn('[AudioService] 智能混音引擎不可用，回退等功率:', e);
      this.applyEqualPowerFallback(savedVolume, duration);
    }

    // 8. 调度清理（过渡结束后）
    this.crossfadeCleanupTimeout = window.setTimeout(() => {
      this.completeCrossfadeCleanup(nextSound, nextTrack);
    }, actualDuration * 1000 + 200);

    // 9. 发出事件
    this.emit('crossfade-start', { track: nextTrack, duration: actualDuration, level: usedLevel });

    return true;
  }

  /** 等功率回退：智能引擎不可用时使用 */
  private applyEqualPowerFallback(savedVolume: number, duration: number): void {
    const ctx = this.context;
    if (!ctx || !this.gainNode || !this.crossfadeGain) return;
    const now = ctx.currentTime;
    const samples = Math.max(64, Math.ceil(duration * 100));
    const curveOut = new Float32Array(samples);
    const curveIn = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const angle = (Math.PI * t) / 2;
      curveOut[i] = Math.cos(angle) * savedVolume;
      curveIn[i] = Math.sin(angle) * savedVolume;
    }
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(savedVolume, now);
    this.gainNode.gain.setValueCurveAtTime(curveOut, now, duration);
    this.gainNode.gain.setValueAtTime(0, now + duration + 0.001);
    this.crossfadeGain.gain.setValueAtTime(0, now);
    this.crossfadeGain.gain.setValueCurveAtTime(curveIn, now, duration);
    this.crossfadeGain.gain.setValueAtTime(savedVolume, now + duration + 0.001);
  }

  /** crossfade 完成后的清理：停止旧歌曲、重建 EQ */
  private completeCrossfadeCleanup(
    nextSound: Howl | LocalAudioPlayer,
    nextTrack: SongResult
  ): void {
    // 保存旧歌曲引用
    const oldSound = this.currentSound;

    // ⚠️ 先更新引用再 stop 旧歌曲——这样旧曲 stop() 触发的 'pause' 事件
    // 在 setupSoundEvents 的守卫 (this.currentSound === sound) 检查时
    // 会因为 currentSound 已指向新曲而跳过，避免误发 pause 事件
    // 导致 MusicHook 将 play 状态设为 false 并清除进度 interval
    this.currentSound = nextSound;
    this.currentTrack = nextTrack;
    this.crossfadingSound = null;
    this.crossfadeCleanupTimeout = null;

    // 停止旧歌曲
    if (oldSound && oldSound !== nextSound) {
      try { oldSound.stop(); oldSound.unload(); } catch (e) {
        console.warn('[AudioService] 停止旧音频失败:', e);
      }
    }

    // 断开 crossfadeGain
    if (this.crossfadeGain) {
      try { this.crossfadeGain.disconnect(); } catch {}
      this.crossfadeGain = null;
    }

    // 重建 EQ 链
    this.disposeEQ(true).then(() => {
      return this.setupEQ(nextSound);
    }).then(() => {
      const savedVolume = parseFloat(localStorage.getItem('volume') || '1');
      this.applyVolume(savedVolume);
      this.updateMediaSessionMetadata(nextTrack);
      this.updateMediaSessionState(true);
      this.emit('load');
    }).catch(e => {
      console.error('[AudioService] crossfade EQ 重建失败:', e);
    }).finally(() => {
      this.emit('crossfade-complete', { track: nextTrack });
    });
  }

  /** 设置音频事件监听（提取自 play 方法，crossfade 复用） */
  private setupSoundEvents(sound: Howl | LocalAudioPlayer): void {
    sound.off('play');
    sound.off('pause');
    sound.off('end');
    sound.off('seek');

    sound.on('play', () => {
      if (this.currentSound === sound || this.crossfadingSound === sound) {
        this.updateMediaSessionState(true);
        this.emit('play');
      }
    });

    sound.on('pause', () => {
      if (this.currentSound === sound || this.crossfadingSound === sound) {
        this.updateMediaSessionState(false);
        this.emit('pause');
      }
    });

    sound.on('end', () => {
      if (this.currentSound === sound) {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'none';
        }
        this.emit('end');
      }
    });

    sound.on('seek', () => {
      if (this.currentSound === sound || this.crossfadingSound === sound) {
        this.updateMediaSessionPositionState();
        this.emit('seek');
      }
    });
  }

  // 播放控制相关
  public play(
    url: string,
    track: SongResult,
    isPlay: boolean = true,
    seekTime: number = 0,
    existingSound?: Howl | LocalAudioPlayer
  ): Promise<Howl | LocalAudioPlayer> {
    // 如果没有提供新的 URL 和 track，且当前有音频实例，则继续播放当前音频
    if (this.currentSound && !url && !track) {
      if (this.seekLock && this.seekDebounceTimer) {
        clearTimeout(this.seekDebounceTimer);
        this.seekLock = false;
      }
      this.currentSound.play();
      return Promise.resolve(this.currentSound);
    }

    // 取消正在进行的 crossfade
    this.cancelCrossfade();

    // 新播放请求：强制重置旧锁，确保不会被遗留锁阻塞
    this.forceResetOperationLock();

    // 获取操作锁
    if (!this.setOperationLock()) {
      // 理论上不会到这里（刚刚 forceReset 过），但作为防御性编程
      console.warn('audioService: 获取操作锁失败，强制继续');
      this.forceResetOperationLock();
      this.setOperationLock();
    }

    // 如果没有提供必要的参数，返回错误
    if (!url || !track) {
      this.releaseOperationLock();
      return Promise.reject(new Error('缺少必要参数: url和track'));
    }

    // 检查是否是同一首歌曲的无缝切换（Hot-Swap）
    const isHotSwap =
      this.currentTrack && track && this.currentTrack.id === track.id && this.currentSound;

    if (isHotSwap) {
    }

    return new Promise<Howl>((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 1;

      // 如果有正在加载的 pendingSound，先清理掉
      if (this.pendingSound) {
        this.pendingSound.unload();
        this.pendingSound = null;
      }

      const tryPlay = async () => {
        try {

          // 确保 Howler 上下文已初始化
          if (!Howler.ctx) {
            Howler.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          }

          // 确保使用同一个音频上下文
          if (Howler.ctx.state === 'closed') {
            Howler.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.context = Howler.ctx;
            Howler.masterGain = this.context.createGain();
            Howler.masterGain.connect(this.context.destination);
            // 重新创建上下文后恢复输出设备
            this.restoreSavedAudioDevice();
          }

          // 恢复上下文状态
          if (Howler.ctx.state === 'suspended') {
            await Howler.ctx.resume();
          }

          // 非热切换模式下，先停止并清理现有的音频实例
          if (!isHotSwap && this.currentSound) {
            // 确保任何进行中的seek操作被取消
            if (this.seekLock && this.seekDebounceTimer) {
              clearTimeout(this.seekDebounceTimer);
              this.seekLock = false;
            }
            this.currentSound.stop();
            this.currentSound.unload();
            this.currentSound = null;
          }

          // 清理 EQ 但保持上下文 (热切换时暂时不清理，等切换完成后再处理)
          if (!isHotSwap) {
            await this.disposeEQ(true);
          }

          // 如果不是热切换，立即更新 currentTrack
          if (!isHotSwap) {
            this.currentTrack = track;
          }

          let newSound: Howl | LocalAudioPlayer;

          if (existingSound) {
            newSound = existingSound;
            if (!(newSound instanceof LocalAudioPlayer)) {
              newSound.volume(1);
              newSound.rate(this.playbackRate);
            } else {
              newSound.rate(this.playbackRate);
            }
          } else if (url.startsWith('local://')) {
            newSound = new LocalAudioPlayer(url);
          } else {
            newSound = new Howl({
              src: [url],
              html5: true,
              autoplay: false,
              volume: 1,
              rate: this.playbackRate,
              format: ['mp3', 'aac']
            });
          }

          // 统一设置事件处理
          const setupEvents = () => {
            if (newSound instanceof LocalAudioPlayer) {
              newSound.off('loaderror');
              newSound.off('load');

              newSound.on('loaderror', (error) => {
                console.error('LocalAudio load error:', error);
                this.emit('loaderror', { track, error: error?.message || error });
                if (retryCount < maxRetries && !existingSound) {
                  retryCount++;
                  setTimeout(tryPlay, 1000 * retryCount);
                } else {
                  this.releaseOperationLock();
                  if (isHotSwap) this.pendingSound = null;
                  reject(new Error('本地文件加载失败'));
                }
              });
            } else {
              newSound.off('loaderror');
              newSound.off('playerror');
              newSound.off('load');

              newSound.on('loaderror', (_, error) => {
                console.error('Audio load error:', error);
                if (this.currentSound === newSound && newSound.state() === 'loaded') {
                  console.warn('seek 后重新加载失败，继续当前播放');
                  return;
                }
                this.emit('loaderror', { track, error });
                if (retryCount < maxRetries && !existingSound) {
                  retryCount++;
                  setTimeout(tryPlay, 1000 * retryCount);
                } else {
                  const isLocal = track.playMusicUrl?.startsWith('local://');
                  if (!isLocal) {
                    this.emit('url_expired', track);
                }
                this.releaseOperationLock();
                if (isHotSwap) this.pendingSound = null;
                reject(new Error(isLocal ? '本地文件加载失败' : '音频加载失败，请尝试切换其他歌曲'));
              }
            });

            newSound.on('playerror', (_, error) => {
              console.error('Audio play error:', error);
              this.emit('playerror', { track, error });
              if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(tryPlay, 1000 * retryCount);
              } else {
                const isLocal = track.playMusicUrl?.startsWith('local://');
                if (!isLocal) {
                  this.emit('url_expired', track);
                }
                this.releaseOperationLock();
                if (isHotSwap) this.pendingSound = null;
                reject(new Error('音频播放失败，请尝试切换其他歌曲'));
              }
            });
            } // close else (not LocalAudioPlayer)

            const onLoaded = async () => {
              try {
                if (isHotSwap) {

                  let targetPos = 0;
                  if (seekTime > 0) {
                    targetPos = seekTime;
                  } else if (this.currentSound) {
                    targetPos = this.currentSound.seek() as number;
                  }

                  newSound.seek(targetPos);

                  await this.disposeEQ(true);
                  await this.setupEQ(newSound);

                  if (isPlay) {
                    newSound.play();
                  }

                  if (this.currentSound) {
                    this.currentSound.stop();
                    this.currentSound.unload();
                  }

                  this.currentSound = newSound;
                  this.currentTrack = track;
                  this.pendingSound = null;

                } else {
                  await this.setupEQ(newSound);
                  this.currentSound = newSound;
                }

                const savedVolume = localStorage.getItem('volume');
                if (savedVolume) {
                  this.applyVolume(parseFloat(savedVolume));
                }

                if (this.currentSound) {
                  try {
                    if (!isHotSwap && seekTime > 0) {
                      this.currentSound.seek(seekTime);
                    }

                    this.updateMediaSessionMetadata(track);
                    this.updateMediaSessionPositionState();
                    this.emit('load');

                    if (!isHotSwap) {
                      if (isPlay) {
                        this.currentSound.play();
                      }
                    }

                    this.releaseOperationLock();
                    resolve(this.currentSound);
                  } catch (error) {
                    console.error('Audio initialization failed:', error);
                    this.releaseOperationLock();
                    reject(error);
                  }
                }
              } catch (error) {
                console.error('Audio initialization failed:', error);
                this.releaseOperationLock();
                reject(error);
              }
            };

            if (newSound.state() === 'loaded') {
              onLoaded();
            } else if (newSound instanceof LocalAudioPlayer) {
              newSound.on('load', onLoaded);
            } else {
              (newSound as Howl).once('load', onLoaded);
            }
          };

          setupEvents();

          if (isHotSwap) {
            this.pendingSound = newSound;
          } else {
            this.currentSound = newSound;
          }

          // 设置音频事件监听
          this.setupSoundEvents(newSound);
        } catch (error) {
          console.error('Error creating audio instance:', error);
          this.releaseOperationLock();
          reject(error);
        }
      };

      tryPlay();
    }).finally(() => {
      // 无论成功或失败都解除操作锁
      this.releaseOperationLock();
    });
  }

  getCurrentSound() {
    return this.currentSound;
  }

  getCurrentTrack() {
    return this.currentTrack;
  }

  // ==================== 智能混音接口 ====================

  /** 获取 AudioContext（供 useSmartAudio 使用） */
  getAudioContext(): AudioContext | null {
    return this.context;
  }

  /** 获取混音挂载点（gainNode），crossfade 节点在此之后插入 */
  getMixNode(): GainNode | null {
    return this.gainNode;
  }

  /** 获取 masterGain（最终输出节点） */
  getMasterGain(): GainNode | null {
    return (Howler as any).masterGain ?? null;
  }

  /** 获取三频段能量（复用 drumDetector） */
  getBandEnergies(): { low: number; mid: number; high: number } {
    return drumDetector.getBandEnergies();
  }

  /** 获取当前实时 BPM（复用 drumDetector） */
  getRealtimeBpm(): number {
    return drumDetector.bpm;
  }

  stop() {
    // 取消正在进行的 crossfade
    this.cancelCrossfade();
    try {
      if (this.currentSound) {
        try {
          // 确保任何进行中的seek操作被取消
          if (this.seekLock && this.seekDebounceTimer) {
            clearTimeout(this.seekDebounceTimer);
            this.seekLock = false;
          }
          this.currentSound.stop();
          this.currentSound.unload();
        } catch (error) {
          console.error('停止音频失败:', error);
        }
        this.currentSound = null;
      }

      this.currentTrack = null;
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
      this.disposeEQ();
    } catch (error) {
      console.error('停止音频时发生错误:', error);
    }
  }

  setVolume(volume: number) {
    this.applyVolume(volume);
  }

  private _lastSeekTime = 0;
  private readonly _SEEK_DEBOUNCE_MS = 100;

  seek(time: number) {
    const now = Date.now();
    if (now - this._lastSeekTime < this._SEEK_DEBOUNCE_MS) {
      return;
    }
    this._lastSeekTime = now;

    if (this.currentSound) {
      try {
        this.currentSound.seek(time);
        this.updateMediaSessionPositionState();
        this.emit('seek', time);
      } catch (error) {
        console.error('Seek操作失败:', error);
      }
    }
  }

  pause() {
    if (this.currentSound) {
      try {
        // 确保任何进行中的seek操作被取消
        if (this.seekLock && this.seekDebounceTimer) {
          clearTimeout(this.seekDebounceTimer);
          this.seekLock = false;
        }
        this.currentSound.pause();
      } catch (error) {
        console.error('暂停音频失败:', error);
      }
    }
    // crossfade 期间暂停也暂停新歌曲
    if (this.crossfadingSound) {
      try { this.crossfadingSound.pause(); } catch {}
    }
  }

  clearAllListeners() {
    this.callbacks = {};
  }

  public getCurrentPreset(): string | null {
    return localStorage.getItem('currentPreset');
  }

  public setCurrentPreset(preset: string): void {
    localStorage.setItem('currentPreset', preset);
  }

  // ==================== 音频输出设备管理 ====================

  /**
   * 获取可用的音频输出设备列表
   */
  public async getAudioOutputDevices(): Promise<AudioOutputDevice[]> {
    try {
      // 先尝试获取一个临时音频流来触发权限授予
      // 确保 enumerateDevices 返回完整的设备信息（包括 label）
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        // 即使失败也继续，可能已有权限
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

      return audioOutputs.map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Speaker ${index + 1}`,
        isDefault: device.deviceId === 'default' || device.deviceId === ''
      }));
    } catch (error) {
      console.error('枚举音频设备失败:', error);
      return [{ deviceId: 'default', label: 'Default', isDefault: true }];
    }
  }

  /**
   * 设置音频输出设备
   * 使用 AudioContext.setSinkId() 而不是 HTMLMediaElement.setSinkId()
   * 因为音频通过 MediaElementAudioSourceNode 进入 Web Audio 图后，
   * HTMLMediaElement.setSinkId() 不再生效
   */
  public async setAudioOutputDevice(deviceId: string): Promise<boolean> {
    try {
      if (this.context && typeof (this.context as any).setSinkId === 'function') {
        await (this.context as any).setSinkId(deviceId);
        this.currentSinkId = deviceId;
        localStorage.setItem('audioOutputDeviceId', deviceId);
        return true;
      } else {
        console.warn('AudioContext.setSinkId 不可用');
        return false;
      }
    } catch (error) {
      console.error('设置音频输出设备失败:', error);
      return false;
    }
  }

  /**
   * 获取当前输出设备ID
   */
  public getCurrentSinkId(): string {
    return this.currentSinkId;
  }

  /**
   * 恢复保存的音频输出设备设置
   */
  private async restoreSavedAudioDevice(): Promise<void> {
    const savedDeviceId = localStorage.getItem('audioOutputDeviceId');
    if (savedDeviceId && savedDeviceId !== 'default') {
      try {
        await this.setAudioOutputDevice(savedDeviceId);
      } catch (error) {
        console.warn('恢复音频输出设备失败，回退到默认设备:', error);
        localStorage.removeItem('audioOutputDeviceId');
        this.currentSinkId = 'default';
      }
    }
  }

  /**
   * 设置 AudioContext 状态监控
   * 监听上下文状态变化，自动恢复 suspended 状态
   */
  private setupContextStateMonitoring() {
    if (!this.context || this.contextStateMonitoringInitialized) return;

    this.context.addEventListener('statechange', async () => {

      if (this.context?.state === 'suspended' && this.currentSound?.playing()) {
        try {
          await this.context.resume();
        } catch (e) {
          console.error('Failed to resume AudioContext:', e);
          this.emit('audio_error', { type: 'context_suspended', error: e });
        }
      } else if (this.context?.state === 'closed') {
        console.warn('AudioContext was closed unexpectedly');
        this.emit('audio_error', { type: 'context_closed' });
      }
    });

    this.contextStateMonitoringInitialized = true;
  }

  /**
   * 验证音频图是否正确连接
   * 用于检测音频播放前的图状态
   */
  // 检查音频图是否连接（调试用，保留供 EQ 诊断）
  // @ts-ignore 保留供调试使用
  private isAudioGraphConnected(): boolean {
    if (!this.context || !this.gainNode || !this.source) {
      return false;
    }

    try {
      // 检查 context 是否运行
      if (this.context.state !== 'running') {
        console.warn('AudioContext is not running, state:', this.context.state);
        return false;
      }

      // Web Audio API 不直接暴露连接状态，
      // 但我们可以验证节点存在且 context 有效
      return true;
    } catch (e) {
      console.error('Error checking audio graph:', e);
      return false;
    }
  }

  public setPlaybackRate(rate: number) {
    if (!this.currentSound) return;
    this.playbackRate = rate;

    this.currentSound.rate(rate);

    // 取出底层 HTMLAudioElement，改原生 playbackRate（仅适用于 Howl）
    if (!(this.currentSound instanceof LocalAudioPlayer)) {
      const sounds = (this.currentSound as any)._sounds as any[];
      if (sounds) {
        sounds.forEach(({ _node }) => {
          if (_node instanceof HTMLAudioElement) {
            _node.playbackRate = rate;
          }
        });
      }
    }

    // 同步给 Media Session UI
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      navigator.mediaSession.setPositionState({
        duration: this.currentSound.duration(),
        playbackRate: rate,
        position: this.currentSound.seek() as number
      });
    }
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  // 新的音量调节方法
  private applyVolume(volume: number) {
    // 确保值在0到1之间
    const normalizedVolume = Math.max(0, Math.min(1, volume));

    // 使用线性缩放音量
    const linearVolume = normalizedVolume;

    // 将音量应用到所有相关节点
    if (this.gainNode) {
      // 立即设置音量
      this.gainNode.gain.cancelScheduledValues(this.context!.currentTime);
      this.gainNode.gain.setValueAtTime(linearVolume, this.context!.currentTime);
    } else {
      this.currentSound?.volume(linearVolume);
    }

    // 保存值
    localStorage.setItem('volume', linearVolume.toString());

  }

  // 添加方法检查当前音频是否在加载状态
  isLoading(): boolean {
    if (!this.currentSound) return false;

    if (this.currentSound instanceof LocalAudioPlayer) {
      return this.currentSound.state() === 'loading';
    }

    const state = (this.currentSound as any)._state;
    return state === 'loading' || state === 1;
  }

  // 检查音频是否真正在播放
  isActuallyPlaying(): boolean {
    if (!this.currentSound) return false;

    try {
      // 核心判断：Howler API 是否报告正在播放 + 音频上下文是否正常
      const isPlaying = this.currentSound.playing();
      const isLoading = this.isLoading();
      const contextRunning = Howler.ctx && Howler.ctx.state === 'running';

      return isPlaying && !isLoading && contextRunning;
    } catch (error) {
      console.error('检查播放状态出错:', error);
      return false;
    }
  }
}

export const audioService = new AudioService();
