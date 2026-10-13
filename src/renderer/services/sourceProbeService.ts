/**
 * 歌曲来源探测服务
 *
 * 职责：
 * 1. 即时分类（零请求）：基于网易云返回的 fee/privilege/noCopyrightRcmd 字段快速标注
 * 2. 懒探测（有请求）：对非网易云直连的歌曲，按 musicParser 策略链尝试解析，标注真实可用来源
 * 3. 并发控制：批量探测时限制并发数，避免压垮音源 API
 * 4. 内存缓存：探测结果缓存在内存，切换筛选不重复探测
 *
 * 注意：探测使用 musicParser 的策略链，但探测完成后会清除该歌曲的失败缓存，
 * 避免探测中的临时失败影响后续正常播放。
 */

import {
  CacheManager,
  MusicSourceStrategyFactory,
  getMusicConfig
} from '@/api/musicParser';
import { useSettingsStore } from '@/store';
import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';

/**
 * 来源标签类型
 */
export type SourceLabel =
  | 'netease' // 网易云直连（免费可播）
  | 'netease-vip' // 网易云 VIP 歌曲
  | 'lxmusic' // LX 脚本音源
  | 'custom' // 自定义 API
  | 'gdmusic' // GD 音乐台
  | 'unblock' // 解锁音源（咪咕/酷狗/酷我/QQ）
  | 'cross-qq' // 跨平台：QQ 音乐
  | 'cross-migu' // 跨平台：咪咕音乐
  | 'cross-kugou' // 跨平台：酷狗音乐
  | 'cross-kuwo' // 跨平台：酷我音乐
  | 'cross-joox' // 跨平台：JOOX（QQ 音乐国际版）
  | 'none' // 无可用源
  | 'pending'; // 探测中

/**
 * 来源标签的显示配置
 */
export const SOURCE_LABEL_CONFIG: Record<
  SourceLabel,
  { text: string; color: string; bg: string }
> = {
  netease: { text: '网易云', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  'netease-vip': { text: '网易云VIP', color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  lxmusic: { text: 'LX音源', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
  custom: { text: '自定义API', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  gdmusic: { text: 'GD音乐台', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  unblock: { text: '解锁音源', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  'cross-qq': { text: 'QQ音乐', color: '#1296db', bg: 'rgba(18,150,219,0.12)' },
  'cross-migu': { text: '咪咕', color: '#ff6b35', bg: 'rgba(255,107,53,0.12)' },
  'cross-kugou': { text: '酷狗', color: '#2196f3', bg: 'rgba(33,150,243,0.12)' },
  'cross-joox': { text: 'JOOX', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  'cross-kuwo': { text: '酷我', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  none: { text: '无可用源', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
  pending: { text: '探测中', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' }
};

// 内存缓存：songId → 来源标签
const probeCache = new Map<string, SourceLabel>();

// 探测中的歌曲集合（避免重复探测）
const probingSet = new Set<string>();

// 单策略探测超时（毫秒）
const STRATEGY_TIMEOUT_MS = 6000;

// 批量探测并发数
const BATCH_CONCURRENCY = 3;

/**
 * 即时分类（零网络请求）
 * 基于网易云搜索结果自带的 fee/privilege/noCopyrightRcmd 字段快速判断
 * 跨平台歌曲直接根据 platform 字段标注
 */
export function quickClassify(song: any): SourceLabel {
  // 跨平台歌曲直接返回对应平台标签（无需探测）
  if (song?.platform && song.platform !== 'netease') {
    switch (song.platform) {
      case 'qq':
        return 'cross-qq';
      case 'migu':
        return 'cross-migu';
      case 'kugou':
        return 'cross-kugou';
      case 'joox':
        return 'cross-joox';
      case 'kuwo':
        return 'cross-kuwo';
      default:
        return 'none';
    }
  }

  const fee = song?.fee ?? song?.privilege?.fee ?? 0;
  const privilege = song?.privilege;
  const hasNoCopyright = Boolean(song?.noCopyrightRcmd);

  // 无版权：noCopyrightRcmd 存在，或 privilege.st !== 0，或 privilege.pl === 0
  if (
    hasNoCopyright ||
    (privilege && privilege.st !== 0) ||
    (privilege && privilege.pl === 0)
  ) {
    // 无版权歌曲需要探测解锁音源，先标记为 pending
    return 'pending';
  }

  // VIP 歌曲
  if (fee === 1) {
    return 'netease-vip';
  }

  // 免费可播
  return 'netease';
}

/**
 * 探测单首歌曲的可用来源（有网络请求）
 * 按策略优先级依次尝试，第一个成功策略的名称映射为来源标签
 *
 * 注意：跨平台歌曲（platform + platformId）不需要探测，
 * quickClassify 已直接标注对应平台标签。
 *
 * @param song 歌曲数据（SongResult 格式）
 * @returns 来源标签
 */
export async function probeSongSource(song: SongResult): Promise<SourceLabel> {
  const songId = String(song.id);

  // 已有缓存直接返回
  const cached = probeCache.get(songId);
  if (cached && cached !== 'pending') {
    return cached;
  }

  // 跨平台歌曲无需探测，直接返回平台标签
  if (song.platform && song.platform !== 'netease') {
    const label = quickClassify(song);
    probeCache.set(songId, label);
    return label;
  }

  // 正在探测中，等待
  if (probingSet.has(songId)) {
    return 'pending';
  }

  probingSet.add(songId);

  try {
    // 非 Electron 环境无法使用解锁策略
    if (!isElectron) {
      const label: SourceLabel = 'none';
      probeCache.set(songId, label);
      return label;
    }

    let settingsStore: any;
    try {
      settingsStore = useSettingsStore();
    } catch {
      probeCache.set(songId, 'none');
      return 'none';
    }

    // 音乐解析功能未启用
    if (!settingsStore?.setData?.enableMusicUnblock) {
      probeCache.set(songId, 'none');
      return 'none';
    }

    const { musicSources, quality } = getMusicConfig(Number(song.id), settingsStore);

    if (musicSources.length === 0) {
      probeCache.set(songId, 'none');
      return 'none';
    }

    const strategies = MusicSourceStrategyFactory.getAvailableStrategies(
      musicSources,
      settingsStore
    );

    if (strategies.length === 0) {
      probeCache.set(songId, 'none');
      return 'none';
    }

    // 按优先级依次尝试策略
    let resultLabel: SourceLabel = 'none';
    for (const strategy of strategies) {
      try {
        const result = await Promise.race([
          strategy.parse(Number(song.id), song, quality, musicSources),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('probe timeout')), STRATEGY_TIMEOUT_MS)
          )
        ]);

        if (result?.data?.data?.url) {
          resultLabel = strategyNameToLabel(strategy.name);
          break;
        }
      } catch {
        // 超时或失败，继续下一个策略
      }
    }

    // 探测完成后清除失败缓存，避免影响后续正常播放
    CacheManager.clearFailedCache(Number(song.id));

    probeCache.set(songId, resultLabel);
    return resultLabel;
  } catch {
    probeCache.set(songId, 'none');
    return 'none';
  } finally {
    probingSet.delete(songId);
  }
}

/**
 * 策略名映射为来源标签
 */
function strategyNameToLabel(name: string): SourceLabel {
  switch (name) {
    case 'lxMusic':
      return 'lxmusic';
    case 'custom':
      return 'custom';
    case 'gdmusic':
      return 'gdmusic';
    case 'unblockMusic':
      return 'unblock';
    default:
      return 'none';
  }
}

/**
 * 批量探测歌曲来源（带并发控制）
 *
 * @param songs 待探测歌曲列表
 * @param onProgress 进度回调（已完成数, 总数）
 * @param onSongProbed 单首探测完成回调（songId, label）
 */
export async function probeSongsBatch(
  songs: SongResult[],
  onProgress?: (done: number, total: number) => void,
  onSongProbed?: (songId: string, label: SourceLabel) => void
): Promise<void> {
  // 过滤出需要探测的歌曲（pending 状态且未缓存）
  const toProbe = songs.filter((song) => {
    const id = String(song.id);
    const cached = probeCache.get(id);
    return !cached || cached === 'pending';
  });

  if (toProbe.length === 0) {
    onProgress?.(songs.length, songs.length);
    return;
  }

  let done = 0;
  const total = toProbe.length;

  // 并发池
  const pool: Promise<void>[] = [];
  let index = 0;

  const probeOne = async (song: SongResult) => {
    const label = await probeSongSource(song);
    done++;
    onProgress?.(done, total);
    onSongProbed?.(String(song.id), label);
  };

  while (index < toProbe.length) {
    // 填充并发池
    while (pool.length < BATCH_CONCURRENCY && index < toProbe.length) {
      const song = toProbe[index++];
      pool.push(probeOne(song));
    }
    // 等待至少一个完成
    await Promise.race(pool);
    // 移除已完成的
    for (let i = pool.length - 1; i >= 0; i--) {
      // Promise.race 不会告诉我们哪个完成了，用settled检查
      // 这里用简单方式：所有都 await 后重新填充
    }
    // 简化：等待全部当前池完成再继续下一批
    await Promise.allSettled(pool);
    pool.length = 0;
  }
}

/**
 * 获取歌曲的缓存来源标签（不触发探测）
 */
export function getCachedLabel(songId: string | number): SourceLabel | undefined {
  return probeCache.get(String(songId));
}

/**
 * 预设来源标签（用于即时分类，不触发探测）
 */
export function setLabel(songId: string | number, label: SourceLabel): void {
  probeCache.set(String(songId), label);
}

/**
 * 清除所有探测缓存
 */
export function clearProbeCache(): void {
  probeCache.clear();
  probingSet.clear();
}

/**
 * 清除指定歌曲的探测缓存
 */
export function clearSongProbe(songId: string | number): void {
  probeCache.delete(String(songId));
}
