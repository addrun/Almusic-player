/**
 * SmartMixService — 智能混音服务（单例）
 *
 * 职责：
 *   1. 监控当前播放进度（由 MusicHook 的进度 interval 调用）
 *   2. 当剩余时间 <= crossfadeDuration 时，预加载下一首并触发 crossfade
 *   3. crossfade 完成后更新播放状态（歌词/播放列表索引/标题等）
 *   4. 协调 'end' 事件处理（crossfade 期间跳过 nextPlay）
 *
 * 不创建新的 AudioContext，复用 audioService 的 context 和 Howler.ctx
 */

import { Howl } from 'howler';

import { isLocalSong } from '@/hooks/useLocalMusic';
import type { SongResult } from '@/types/music';
import { getImgUrl } from '@/utils';
import { getImageLinearBackground } from '@/utils/linearColor';

import { audioService } from './audioService';
import { drumDetector } from './drumDetector';
import { LocalAudioPlayer } from './localAudioPlayer';
import { preloadService } from './preloadService';

class SmartMixService {
  private isCrossfading = false;

  // ==================== 段落门控 ====================
  /** 是否正在等待段落结束以触发 crossfade */
  private pendingCrossfade = false;
  /** 进入 pending 状态的时间戳 */
  private pendingSince = 0;
  /** 段落门控硬上限：超过此时间强制触发 crossfade */
  private readonly MAX_DEFER_MS = 12000;

  // ==================== 署名类关键词 ====================
  /** 署名/致谢/结尾类关键词：命中时绕过门控直接开始渐变切歌 */
  private static readonly ATTRIBUTION_KEYWORDS: readonly string[] = [
    // ===== 中文 — 制作人员 =====
    '作词', '作曲', '编曲', '填词', '谱曲',
    '制作人', '监制', '统筹', '企划',
    '吉他', '贝斯', '鼓', '键盘', '钢琴', '小提琴', '大提琴', '萨克斯', '笛子', '二胡', '琵琶', '古筝',
    '和声', '伴唱', '合唱', '童声',
    '混音', '母带', '录音', '后期', '编曲混音',
    '录音室', '录音棚', '混音棚',
    // ===== 中文 — 出品/版权 =====
    '出品', '出品人', '出品方', '发行', '发行公司', '唱片公司',
    '版权', '著作权', '制作公司', '工作室', '厂牌',
    // ===== 中文 — 致谢/结尾 =====
    '感谢', '鸣谢', '致谢', '特别感谢', '献给', '谨以此歌',
    '谢谢', '晚安', '再见', '感谢聆听', '未完待续', '敬请期待', '下期再见',
    // ===== 英文 — 制作人员 =====
    'lyrics by', 'written by', 'composed by', 'arranged by',
    'produced by', 'executive producer', 'co-producer',
    'guitar', 'bass', 'drums', 'keyboard', 'piano', 'violin', 'cello', 'saxophone', 'flute',
    'backing vocals', 'chorus', 'choir', 'featuring', 'feat.',
    'mixed by', 'mastered by', 'recorded by', 'editing',
    'recording studio', 'mixing studio',
    // ===== 英文 — 出品/版权 =====
    'presented by', 'released by', 'record label',
    'copyright', 'all rights reserved',
    'production company', 'studio', 'label',
    // ===== 英文 — 致谢/结尾 =====
    'thanks to', 'acknowledgments', 'dedicated to', 'special thanks',
    'goodbye', 'goodnight', 'thank you', 'thanks for listening', 'to be continued'
  ];

  /** 检测当前歌词行是否为署名/致谢/结尾类 */
  private isAttributionLyric(lineText: string): boolean {
    if (!lineText) return false;
    const lower = lineText.toLowerCase();
    return SmartMixService.ATTRIBUTION_KEYWORDS.some((kw) =>
      lower.includes(kw.toLowerCase())
    );
  }

  /**
   * 检查是否应该触发 crossfade
   * 由 MusicHook 的进度 interval 每 50ms 调用
   */
  async checkCrossfade(currentTime: number, duration: number): Promise<void> {
    // 延迟导入避免循环依赖
    const { useMixEngineStore } = await import('@/store/modules/mixEngine');
    const mixEngine = useMixEngineStore();

    if (!mixEngine.smartMixEnabled) return;
    if (this.isCrossfading) return;
    if (audioService.isCrossfading()) return;

    // 需要有效时长
    if (!duration || duration <= 0) return;

    const remaining = duration - currentTime;
    const crossfadeDuration = mixEngine.crossfadeDuration;

    // 触发窗口：剩余时间 <= crossfadeDuration
    if (remaining > crossfadeDuration || remaining < 0.3) {
      // 离开触发窗口时清理 pending 状态（用户 seek 等）
      this.clearPending();
      return;
    }

    // ===== 署名类歌词检测：命中则绕过门控直接开始渐变 =====
    let bypassGate = false;
    try {
      const { lrcArray, nowIndex } = await import('@/hooks/MusicHook');
      const currentLine = lrcArray.value[nowIndex.value];
      if (currentLine?.text && this.isAttributionLyric(currentLine.text)) {
        bypassGate = true;
        this.clearPending();
      }
    } catch {
      // 歌词数据不可用，跳过
    }

    // ===== 段落门控：高潮段或正在唱的歌词行时延迟 crossfade =====
    if (!bypassGate) {
      const blocking = await this.isSegmentBlocking(currentTime);
      if (blocking) {
        if (!this.pendingCrossfade) {
          this.pendingCrossfade = true;
          this.pendingSince = Date.now();
        }
        if (Date.now() - this.pendingSince < this.MAX_DEFER_MS) {
          return; // 等待段落结束
        }
        // 超过硬上限，强制触发
        console.warn('[SmartMix] 段落门控超时，强制触发 crossfade');
      }
      this.clearPending();
    }

    // 获取下一首
    const { usePlaylistStore } = await import('@/store/modules/playlist');
    const playlistStore = usePlaylistStore();
    const list = playlistStore.playList;
    if (!list || list.length === 0) return;

    // 单曲循环模式不 crossfade
    if (playlistStore.playMode === 1) return;

    const currentIndex = playlistStore.playListIndex;

    // 根据播放模式确定下一首索引
    let nextIndex: number;
    if (playlistStore.playMode === 0) {
      // 顺序播放
      if (currentIndex >= list.length - 1) return; // 最后一首
      nextIndex = currentIndex + 1;
    } else {
      // 列表循环 / 随机
      nextIndex = (currentIndex + 1) % list.length;
    }

    const nextSong = list[nextIndex];
    if (!nextSong) return;

    // 不 crossfade 到同一首歌
    const currentTrack = audioService.getCurrentTrack();
    if (currentTrack && nextSong.id === currentTrack.id) return;

    // ===== 预取下一首背景色（确保 crossfade-start 事件 payload 已带色）=====
    if (!nextSong.backgroundColor || !nextSong.primaryColor) {
      try {
        const bg = await getImageLinearBackground(getImgUrl(nextSong?.picUrl, '30y30'));
        if (bg.backgroundColor) nextSong.backgroundColor = bg.backgroundColor;
        if (bg.primaryColor) nextSong.primaryColor = bg.primaryColor;
      } catch (e) {
        console.warn('[SmartMix] 预取下一首背景色失败:', e);
      }
    }

    // 解析下一首的音频实例
    let nextSound: Howl | LocalAudioPlayer | null = null;

    if (isLocalSong(nextSong) && nextSong.playMusicUrl) {
      // 本地歌曲
      try {
        nextSound = new LocalAudioPlayer(nextSong.playMusicUrl);
        await nextSound.load();
      } catch {
        return; // 加载失败，回退到正常切歌
      }
    } else {
      // 在线歌曲：优先使用预加载的 Howl
      const preloaded = preloadService.consume(nextSong.id);
      if (preloaded && preloaded.state() === 'loaded') {
        nextSound = preloaded;
      } else if (nextSong.playMusicUrl) {
        // 有 URL，创建新 Howl
        try {
          nextSound = await preloadService.load(nextSong);
        } catch {
          return;
        }
      } else {
        // URL 未解析，跳过 crossfade
        return;
      }
    }

    // 触发 crossfade
    await this.doCrossfade(
      nextSound,
      nextSong,
      nextIndex,
      crossfadeDuration,
      mixEngine.transitionLevel
    );
  }

  /** 执行 crossfade 并监听完成/取消事件 */
  private async doCrossfade(
    nextSound: Howl | LocalAudioPlayer,
    nextSong: SongResult,
    nextIndex: number,
    duration: number,
    level: 1 | 2 | 3
  ): Promise<void> {
    this.isCrossfading = true;

    try {
      // Level 2+ 需要 drumDetector 运行
      if (level >= 2 && !drumDetector.running) {
        drumDetector.start();
      }

      const success = await audioService.crossfadeToNext(nextSound, nextSong, duration, level);
      if (!success) {
        this.isCrossfading = false;
        return;
      }

      // 监听 crossfade 完成
      const onComplete = () => {
        audioService.off('crossfade-complete', onComplete);
        audioService.off('crossfade-cancelled', onCancel);
        this.completeTransition(nextSong, nextIndex);
      };
      audioService.on('crossfade-complete', onComplete);

      // 监听 crossfade 取消（用户手动切歌等）
      const onCancel = () => {
        audioService.off('crossfade-complete', onComplete);
        audioService.off('crossfade-cancelled', onCancel);
        this.isCrossfading = false;
        this.clearPending();
      };
      audioService.on('crossfade-cancelled', onCancel);
    } catch (e) {
      // 异常时必须重置 isCrossfading，否则 'end' 事件会被永远跳过
      // 导致播放完当前歌曲后无法自动切到下一首
      console.error('[SmartMix] doCrossfade 异常，重置 isCrossfading:', e);
      this.isCrossfading = false;
      this.clearPending();
    }
  }

  /** crossfade 完成后更新播放状态（不重新播放音频） */
  private async completeTransition(
    nextSong: SongResult,
    nextIndex: number
  ): Promise<void> {
    try {
      // 更新播放列表索引
      const { usePlaylistStore } = await import('@/store/modules/playlist');
      const playlistStore = usePlaylistStore();
      playlistStore.playListIndex = nextIndex;

      // 更新 playerCore 状态
      const { usePlayerCoreStore } = await import('@/store/modules/playerCore');
      const playerCore = usePlayerCoreStore();

      // 加载歌词和背景色
      const { useLyrics } = await import('@/hooks/usePlayerHooks');
      const { loadLrc } = useLyrics();
      const { useLocalMusic } = await import('@/hooks/useLocalMusic');
      const localMusic = useLocalMusic();

      const [lyrics, bg] = await Promise.all([
        isLocalSong(nextSong)
          ? localMusic.loadLocalLyrics(nextSong)
          : loadLrc(nextSong.id),
        nextSong.backgroundColor && nextSong.primaryColor
          ? Promise.resolve({
              backgroundColor: nextSong.backgroundColor,
              primaryColor: nextSong.primaryColor
            })
          : getImageLinearBackground(getImgUrl(nextSong?.picUrl, '30y30'))
      ]);

      nextSong.lyric = lyrics;
      if (bg.backgroundColor) nextSong.backgroundColor = bg.backgroundColor;
      if (bg.primaryColor) nextSong.primaryColor = bg.primaryColor;

      playerCore.playMusic = nextSong;
      playerCore.playMusicUrl = nextSong.playMusicUrl as string;
      playerCore.play = true;
      playerCore.isPlay = true;

      // 更新文档标题
      let title = nextSong.name;
      if (nextSong.source === 'netease' && nextSong?.song?.artists) {
        title += ` - ${nextSong.song.artists.reduce(
          (prev: string, curr: any) => `${prev}${curr.name}/`,
          ''
        )}`;
      }
      document.title = 'Almusic Player - ' + title;

      // 添加到播放历史
      try {
        const { usePlayHistoryStore } = await import('@/store/modules/playHistory');
        const playHistoryStore = usePlayHistoryStore();
        if (nextSong.isPodcast && nextSong.program) {
          playHistoryStore.addPodcast(nextSong.program);
        } else {
          playHistoryStore.addMusic(nextSong);
        }
      } catch (e) {
        console.warn('[SmartMix] 添加播放历史失败:', e);
      }

      // 预加载下下首
      setTimeout(() => {
        try {
          playlistStore.preloadNextSongs(nextIndex);
        } catch (e) {
          console.warn('[SmartMix] 预加载下一首失败:', e);
        }
      }, 3000);

      // 发送给歌词窗口
      if (window.electron) {
        try {
          const { cloneDeep } = await import('lodash');
          (window as any).api?.sendSong?.(cloneDeep(nextSong));
        } catch {}
      }
    } catch (error) {
      console.error('[SmartMix] 状态更新失败:', error);
    } finally {
      this.isCrossfading = false;
      // 在 playerCore.playMusic 已更新后结束 UI 过渡，
      // 避免 finishTransition() 把 displaySrc 闪回旧封面
      try {
        const { useTransitionStore } = await import('@/store/modules/transition');
        useTransitionStore().end();
      } catch { /* transition store 不可用 */ }
    }
  }

  /** 是否正在 crossfade */
  getIsCrossfading(): boolean {
    return this.isCrossfading;
  }

  /** 取消 crossfade（外部调用） */
  cancelCrossfade(): void {
    this.isCrossfading = false;
    this.clearPending();
  }

  // ==================== 段落门控工具 ====================

  /** 清除 pending 状态 */
  private clearPending(): void {
    this.pendingCrossfade = false;
    this.pendingSince = 0;
  }

  /**
   * 检查当前是否处于「不应 crossfade」的段落
   * - 高潮段（isInClimax）
   * - 当前歌词行仍在唱（行间间奏允许切）
   */
  private async isSegmentBlocking(currentTime: number): Promise<boolean> {
    // 1. 高潮段检测
    try {
      const { useStyleEngineStore } = await import('@/store/modules/styleEngine');
      const styleEngine = useStyleEngineStore();
      if (styleEngine.isInClimax) return true;
    } catch {
      // styleEngine 不可用，跳过
    }

    // 2. 当前歌词行仍在唱（行间间奏允许切）
    try {
      const { lrcArray, nowIndex } = await import('@/hooks/MusicHook');
      const currentLine = lrcArray.value[nowIndex.value];
      if (
        currentLine &&
        typeof currentLine.startTime === 'number' &&
        typeof currentLine.duration === 'number' &&
        currentLine.duration > 0
      ) {
        // startTime / duration 均为毫秒，转换为秒
        const lineEnd = (currentLine.startTime + currentLine.duration) / 1000;
        if (currentTime < lineEnd) return true;
      }
    } catch {
      // 歌词数据不可用，跳过
    }

    return false;
  }
}

export const smartMixService = new SmartMixService();
