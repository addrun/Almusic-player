import { cloneDeep } from 'lodash';

import { getMusicDB } from '@/hooks/MusicHook';
import { SongSourceConfigManager } from '@/services/SongSourceConfigManager';
import { useSettingsStore } from '@/store';
import type { SongResult } from '@/types/music';
import { isElectron } from '@/utils';
import { getKugouPlaybackBinding } from '@/utils/kugouPlaybackBinding';
import { stripAudioFileExtension } from '@/utils/kugouPlaybackMatch';
import requestMusic from '@/utils/request_music';

import type { KugouSongUrl } from '../../shared/kugou';
import { isCrossPlatformSong } from './crossPlatformSearch';
import {
  type GDCrossPlatformSearchItem,
  getUrlByPlatform,
  parseFromGDMusic,
  searchFromGDMusic
} from './gdmusic';
import {
  isRejectedKugouPlaybackUrl,
  type KugouPlaybackFallbackSource,
  resolveKugouPlaybackFallback
} from './kugouPlaybackFallback';
import { LxMusicStrategy } from './lxMusicStrategy';
import { parseFromCustomApi } from './parseFromCustomApi';
import { getSearch } from './search';

/**
 * 音乐解析结果接口
 */
export interface MusicParseResult {
  data: {
    code: number;
    message: string;
    data?: {
      url: string;
      [key: string]: any;
    };
  };
}

/**
 * 缓存配置
 */
const CACHE_CONFIG = {
  // 音乐URL缓存时间：30分钟
  MUSIC_URL_CACHE_TIME: 30 * 60 * 1000,
  // 失败缓存时间：1分钟（减少到 1 分钟以便更快恢复）
  FAILED_CACHE_TIME: 1 * 60 * 1000,
  // 重试配置
  MAX_RETRY_COUNT: 2,
  RETRY_DELAY: 1000
};

/**
 * 内存失败缓存（替代 IndexedDB，更轻量且应用重启后自动失效）
 */
const failedCacheMap = new Map<string, number>();

/**
 * 缓存管理器
 */
export class CacheManager {
  /**
   * 获取缓存的音乐URL
   */
  static async getCachedMusicUrl(
    id: number,
    musicSources?: string[]
  ): Promise<MusicParseResult | null> {
    try {
      const db = await getMusicDB();
      const cached = await db.getData('music_url_cache', id);
      if (
        cached?.createTime &&
        Date.now() - cached.createTime < CACHE_CONFIG.MUSIC_URL_CACHE_TIME
      ) {
        // 检查缓存的音源配置是否与当前配置一致
        const cachedSources = cached.musicSources || [];
        const currentSources = musicSources || [];

        // 如果音源配置不一致，清除缓存
        if (JSON.stringify(cachedSources.sort()) !== JSON.stringify(currentSources.sort())) {
          await db.deleteData('music_url_cache', id);
          return null;
        }

        return cached.data;
      }
      // 清理过期缓存
      if (cached) {
        await db.deleteData('music_url_cache', id);
      }
    } catch (error) {
      console.warn('获取缓存失败:', error);
    }
    return null;
  }

  /**
   * 缓存音乐URL
   */
  static async setCachedMusicUrl(
    id: number,
    result: MusicParseResult,
    musicSources?: string[]
  ): Promise<void> {
    try {
      // 深度克隆数据，确保可以被 IndexedDB 存储
      const db = await getMusicDB();
      await db.saveData('music_url_cache', {
        id,
        data: cloneDeep(result),
        musicSources: cloneDeep(musicSources || []),
        createTime: Date.now()
      });
    } catch (error) {
      console.error('缓存音乐URL失败:', error);
    }
  }

  /**
   * 检查是否在失败缓存期内（使用内存缓存）
   */
  static isInFailedCache(id: number, strategyName: string): boolean {
    const cacheKey = `${id}_${strategyName}`;
    const cachedTime = failedCacheMap.get(cacheKey);
    if (cachedTime && Date.now() - cachedTime < CACHE_CONFIG.FAILED_CACHE_TIME) {
      return true;
    }
    // 清理过期缓存
    if (cachedTime) {
      failedCacheMap.delete(cacheKey);
    }
    return false;
  }

  /**
   * 添加失败缓存（使用内存缓存）
   */
  static addFailedCache(id: number, strategyName: string): void {
    const cacheKey = `${id}_${strategyName}`;
    failedCacheMap.set(cacheKey, Date.now());
  }

  /**
   * 清除指定歌曲的失败缓存
   */
  static clearFailedCache(id: number): void {
    const keysToDelete: string[] = [];
    failedCacheMap.forEach((_, key) => {
      if (key.startsWith(`${id}_`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => failedCacheMap.delete(key));
    if (keysToDelete.length > 0) {
    }
  }

  /**
   * 清除指定歌曲的所有缓存
   */
  static async clearMusicCache(id: number): Promise<void> {
    try {
      const db = await getMusicDB();
      // 清除URL缓存
      await db.deleteData('music_url_cache', id);

      // 清除失败缓存 - 需要遍历所有策略
      const strategies = ['custom', 'gdmusic', 'unblockMusic'];
      for (const strategy of strategies) {
        const cacheKey = `${id}_${strategy}`;
        try {
          await db.deleteData('music_failed_cache', cacheKey);
        } catch {
          // 忽略删除不存在缓存的错误
        }
      }
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  }
}

/**
 * 重试工具
 */
class RetryHelper {
  /**
   * 带重试的异步执行
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = CACHE_CONFIG.MAX_RETRY_COUNT,
    delay = CACHE_CONFIG.RETRY_DELAY
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // 指数退避
        }
      }
    }

    throw lastError!;
  }
}

/**
 * 从GD音乐台获取音频URL
 * @param id 歌曲ID
 * @param data 歌曲数据
 * @returns 解析结果，失败时返回null
 */
const getGDMusicAudio = async (id: number, data: SongResult): Promise<ParsedMusicResult | null> => {
  try {
    const gdResult = await parseFromGDMusic(id, data, '999');
    if (gdResult) {
      return gdResult;
    }
  } catch (error) {
    console.error('GD音乐台解析失败:', error);
  }
  return null;
};

/**
 * 使用unblockMusic解析音频URL
 * @param id 歌曲ID
 * @param data 歌曲数据
 * @param sources 音源列表
 * @returns 解析结果
 */
const getUnblockMusicAudio = (id: number, data: SongResult, sources: any[]) => {
  const filteredSources = sources.filter((source) => source !== 'gdmusic');
  return window.api.unblockMusic(id, cloneDeep(data), cloneDeep(filteredSources));
};

/**
 * 统一的解析结果适配器
 */
const adaptParseResult = (result: any): MusicParseResult | null => {
  if (!result) return null;

  // 如果已经是标准格式
  if (result.data?.code !== undefined && result.data?.message !== undefined) {
    return result;
  }

  // 适配GD音乐台的返回格式
  if (result.data?.data?.url) {
    return {
      data: {
        code: 200,
        message: 'success',
        data: {
          url: result.data.data.url,
          ...result.data.data
        }
      }
    };
  }

  // 适配其他格式
  if (result.url) {
    return {
      data: {
        code: 200,
        message: 'success',
        data: {
          url: result.url,
          ...result
        }
      }
    };
  }

  return null;
};

/**
 * 音源解析策略接口
 */
interface MusicSourceStrategy {
  name: string;
  priority: number;
  canHandle: (sources: string[], settingsStore?: any) => boolean;
  parse: (
    id: number,
    data: SongResult,
    quality?: string,
    sources?: string[]
  ) => Promise<MusicParseResult | null>;
}

/**
 * 自定义API解析策略
 */
class CustomApiStrategy implements MusicSourceStrategy {
  name = 'custom';
  priority = 1;

  canHandle(sources: string[], settingsStore?: any): boolean {
    return sources.includes('custom') && Boolean(settingsStore?.setData?.customApiPlugin);
  }

  async parse(id: number, data: SongResult, quality = 'higher'): Promise<MusicParseResult | null> {
    // 检查失败缓存
    if (CacheManager.isInFailedCache(id, this.name)) {
      return null;
    }

    try {
      const result = await RetryHelper.withRetry(async () => {
        return await parseFromCustomApi(id, data, quality);
      });

      const adaptedResult = adaptParseResult(result);
      if (adaptedResult?.data?.data?.url) {
        return adaptedResult;
      }

      // 解析失败，添加失败缓存
      CacheManager.addFailedCache(id, this.name);
      return null;
    } catch (error) {
      console.error('自定义API解析失败:', error);
      CacheManager.addFailedCache(id, this.name);
      return null;
    }
  }
}

/**
 * GD音乐台解析策略
 */
class GDMusicStrategy implements MusicSourceStrategy {
  name = 'gdmusic';
  priority = 3;

  canHandle(sources: string[]): boolean {
    return sources.includes('gdmusic');
  }

  async parse(id: number, data: SongResult): Promise<MusicParseResult | null> {
    // 检查失败缓存
    if (CacheManager.isInFailedCache(id, this.name)) {
      return null;
    }

    try {
      const result = await RetryHelper.withRetry(async () => {
        return await getGDMusicAudio(id, data);
      });

      const adaptedResult = adaptParseResult(result);
      if (adaptedResult?.data?.data?.url) {
        return adaptedResult;
      }

      // 解析失败，添加失败缓存
      CacheManager.addFailedCache(id, this.name);
      return null;
    } catch (error) {
      console.error('GD音乐台解析失败:', error);
      CacheManager.addFailedCache(id, this.name);
      return null;
    }
  }
}

/**
 * UnblockMusic解析策略
 */
class UnblockMusicStrategy implements MusicSourceStrategy {
  name = 'unblockMusic';
  priority = 4;

  canHandle(sources: string[]): boolean {
    const unblockSources = sources.filter((source) => !['custom', 'gdmusic'].includes(source));
    return unblockSources.length > 0;
  }

  async parse(
    id: number,
    data: SongResult,
    _quality?: string,
    sources?: string[]
  ): Promise<MusicParseResult | null> {
    // 检查失败缓存
    if (CacheManager.isInFailedCache(id, this.name)) {
      return null;
    }

    try {
      const unblockSources = (sources || []).filter(
        (source) => !['custom', 'gdmusic'].includes(source)
      );

      const result = await RetryHelper.withRetry(async () => {
        return await getUnblockMusicAudio(id, data, unblockSources);
      });

      const adaptedResult = adaptParseResult(result);
      if (adaptedResult?.data?.data?.url) {
        return adaptedResult;
      }

      // 解析失败，添加失败缓存
      CacheManager.addFailedCache(id, this.name);
      return null;
    } catch (error) {
      console.error('UnblockMusic解析失败:', error);
      CacheManager.addFailedCache(id, this.name);
      return null;
    }
  }
}

/**
 * 跨平台直链解析策略
 *
 * 对跨平台搜索结果（platform + platformId），按以下优先级获取播放 URL：
 * 1. unblockMusic 指定平台（用歌曲名+歌手搜索匹配，最准确）
 * 2. GD 音乐台直链获取（仅限 joox/kuwo/netease 平台，用 platformId 直接获取）
 * 3. GD 音乐台精确搜索匹配（用歌名+歌手在 joox 搜索，精确匹配后获取 URL）
 *
 * 注意：
 * - GD 音乐台不支持 qq/migu/kugou 作为 source（返回 400）
 * - 不再使用 unblockMusic 多平台并发回退，因为 Promise.any 会导致匹配不精确
 *   （可能返回同名但不同歌手的歌曲）
 */
class CrossPlatformStrategy implements MusicSourceStrategy {
  name = 'crossPlatform';
  priority = -1; // 最高优先级（小于 0）

  // 支持通过 unblockMusic 解析的平台
  private static readonly UNBLOCK_PLATFORMS = ['qq', 'migu', 'kugou', 'kuwo', 'joox', 'pyncmd'];
  // GD 音乐台直接支持的平台（可用于 getUrlByPlatform）
  private static readonly GD_SUPPORTED_PLATFORMS = ['joox', 'kuwo', 'netease'];

  canHandle(_sources: string[], _settingsStore?: any): boolean {
    // canHandle 在工厂层面不判断跨平台，由 parseMusic 单独处理
    return true;
  }

  /**
   * 尝试通过 unblockMusic 解析（仅限单平台，避免多平台并发匹配不精确）
   * @param data 歌曲数据
   * @param platform 要尝试的平台
   * @returns 解析结果，失败返回 null
   */
  private async tryUnblockMusic(
    data: SongResult,
    platform: string
  ): Promise<MusicParseResult | null> {
    try {
      const unblockData = {
        name: data.name,
        artists: (data.ar || data.artists || []).map((a) => ({ name: a.name })),
        album: data.al || data.album || { name: '' },
        duration: data.duration || data.dt || data.count || 0
      };

      const unblockResult = await window.api.unblockMusic(
        0, // 跨平台歌曲没有网易云 ID，传 0（unblockMusic 内部用 data 搜索，不依赖 id）
        unblockData,
        [platform]
      );

      // 检测 IPC handler 返回的错误格式 { error: string }
      if (unblockResult?.error) {
        console.warn(
          `[CrossPlatformStrategy] unblockMusic [${platform}] 失败: ${unblockResult.error}`
        );
        return null;
      }

      const adapted = adaptParseResult(unblockResult);
      if (adapted?.data?.data?.url) {
        console.log(`[CrossPlatformStrategy] unblockMusic [${platform}] 解析成功`);
        return adapted;
      }
    } catch (unblockError) {
      console.warn(`[CrossPlatformStrategy] unblockMusic [${platform}] 异常:`, unblockError);
    }
    return null;
  }

  /**
   * 归一化字符串用于比较（小写 + 去空格/标点）
   */
  private static normalizeStr(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/[\s\-_/\(\)\[\]【】（）.,，。、！？!?;；:：'"`~·]+/g, '')
      .trim();
  }

  /**
   * 精确匹配搜索结果：比较歌名和歌手
   * 匹配规则：
   * - 歌名必须完全一致（归一化后）
   * - 歌手必须至少有一个完全一致（归一化后）
   * @param item GD 音乐台搜索结果项
   * @param targetName 目标歌名
   * @param targetArtists 目标歌手列表
   * @returns 匹配分数（0 表示不匹配，>0 表示匹配，分数越高越匹配）
   */
  private static matchScore(
    item: GDCrossPlatformSearchItem,
    targetName: string,
    targetArtists: string[]
  ): number {
    const itemName = CrossPlatformStrategy.normalizeStr(item.name);
    const targetN = CrossPlatformStrategy.normalizeStr(targetName);

    // 歌名必须一致
    if (!itemName || !targetN || itemName !== targetN) {
      return 0;
    }

    // 歌手匹配：至少一个歌手完全一致
    const itemArtists = (item.artist || []).map((a) => CrossPlatformStrategy.normalizeStr(a));
    const targetArtistsNorm = targetArtists.map((a) => CrossPlatformStrategy.normalizeStr(a));

    let artistMatched = false;
    for (const ta of targetArtistsNorm) {
      if (!ta) continue;
      if (itemArtists.some((ia) => ia === ta || ia.includes(ta) || ta.includes(ia))) {
        artistMatched = true;
        break;
      }
    }

    // 歌名一致 + 歌手匹配 = 满分
    // 歌名一致 + 歌手不匹配 = 低分（可能是翻唱或不同版本，仍然可用）
    return artistMatched ? 100 : 10;
  }

  /**
   * 通过 GD 音乐台精确搜索匹配获取 URL
   * 在 joox 音源搜索多首歌曲，精确匹配歌名+歌手后获取 URL
   *
   * @param data 原始歌曲数据（包含歌名和歌手）
   * @param br 音质
   * @returns 解析结果，失败返回 null
   */
  private async tryGdMusicSearchMatch(
    data: SongResult,
    br: string
  ): Promise<MusicParseResult | null> {
    const songName = data.name || '';
    const artistNames = (data.ar || data.artists || []).map((a) => a.name).filter(Boolean);

    if (!songName) {
      return null;
    }

    const searchQuery = artistNames.length > 0 ? `${songName} ${artistNames.join(' ')}` : songName;

    try {
      // 搜索 joox 音源，取前 10 条结果做精确匹配
      const items = await searchFromGDMusic('joox', searchQuery, 10, 1);

      if (!items || items.length === 0) {
        return null;
      }

      // 按匹配分数排序
      const scored = items
        .map((item) => ({
          item,
          score: CrossPlatformStrategy.matchScore(item, songName, artistNames)
        }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 0) {
        console.warn(`[CrossPlatformStrategy] GD 搜索到 ${items.length} 条结果，但无精确匹配`, {
          targetName: songName,
          targetArtists: artistNames
        });
        return null;
      }

      const bestMatch = scored[0].item;
      const matchId = String(bestMatch.url_id || bestMatch.id);

      console.log(
        `[CrossPlatformStrategy] GD 精确匹配成功: "${bestMatch.name}" by [${(bestMatch.artist || []).join(', ')}] (score=${scored[0].score})`
      );

      // 用匹配到的 ID 获取 URL
      const result = await getUrlByPlatform('joox', matchId, br);
      const adapted = adaptParseResult(result);
      if (adapted?.data?.data?.url) {
        console.log(`[CrossPlatformStrategy] GD 搜索匹配解析成功`);
        return adapted;
      }
    } catch (error) {
      console.error('[CrossPlatformStrategy] GD 搜索匹配异常:', error);
    }
    return null;
  }

  /** Imported tracks can use the same Netease search catalog as the search page. */
  private async tryImportedKugouFallback(
    data: SongResult,
    br: string,
    quality: string
  ): Promise<MusicParseResult | null> {
    const settings = useSettingsStore();
    const config = getMusicConfig(data.id, settings);
    const sources: KugouPlaybackFallbackSource[] = [
      {
        name: 'netease',
        search: async (query) => {
          const response = await getSearch({ keywords: query, type: 1, limit: 20 });
          const songs = response.data?.result?.songs;
          if (!Array.isArray(songs)) return [];
          return songs
            .filter((song) => Number.isSafeInteger(song.id) && song.id > 0)
            .map((song) => ({
              ...song,
              picUrl: song.al?.picUrl || '',
              count: 0,
              platform: 'netease',
              platformId: undefined,
              kugou: undefined
            }));
        },
        resolve: async (candidate, signal) => {
          // Lazy import avoids the music.ts -> MusicParser module cycle.
          const { getMusicUrl } = await import('./music');
          try {
            const response = await getMusicUrl(Number(candidate.id));
            const audio = response.data?.data?.[0];
            if (audio?.url && !audio.freeTrialInfo) {
              return { data: { code: 200, message: 'Netease', data: audio } };
            }
          } catch {
            // A matched catalog entry may also be available via enabled plugins.
          }
          if (signal?.aborted || !settings.setData.enableMusicUnblock) return null;
          // GD and name-based unblock are handled below with explicit matching,
          // rather than accepting their unrestricted first search result.
          const plugins = MusicSourceStrategyFactory.getAvailableStrategies(
            config.musicSources,
            settings
          ).filter((strategy) => ['custom', 'lxMusic'].includes(strategy.name));
          for (const plugin of plugins) {
            if (signal?.aborted) return null;
            try {
              const result = await plugin.parse(
                Number(candidate.id),
                candidate,
                quality,
                config.musicSources
              );
              if (result?.data?.data?.url) return result;
            } catch {
              continue;
            }
          }
          return null;
        }
      }
    ];

    const gdEnabled =
      settings.setData.enableMusicUnblock && config.musicSources.includes('gdmusic');
    // Use the same GD catalogs as ordinary search-result playback, while still
    // validating each candidate instead of accepting the first title result.
    const gdPlatforms = gdEnabled ? ['joox', 'tidal', 'netease'] : ['joox'];
    for (const platform of gdPlatforms) {
      sources.push({
        name: `gd-${platform}`,
        search: async (query) => {
          const items = await searchFromGDMusic(platform, query, 20, 1);
          return items
            .filter(
              (item) =>
                Boolean(item.url_id || item.id) &&
                (!item.source || gdPlatforms.includes(item.source))
            )
            .map((item) => ({
              ...data,
              id: `${platform}:${item.url_id || item.id}`,
              name: item.name,
              ar: (item.artist || []).map((name) => ({ name })) as SongResult['ar'],
              artists: undefined,
              al: { ...data.al, name: item.album || '' },
              // GD search does not provide a verified duration field.
              dt: 0,
              duration: 0,
              platform: item.source || platform,
              platformId: String(item.url_id || item.id),
              kugou: undefined,
              playMusicUrl: undefined
            }));
        },
        resolve: async (candidate, signal) => {
          // Ordinary GD parsing requests 999. Some provider versions only expose
          // that quality, so try it before the user's lower-quality preference.
          for (const gdQuality of [...new Set(['999', br])]) {
            if (signal?.aborted) return null;
            const result = adaptParseResult(
              await getUrlByPlatform(candidate.platform!, candidate.platformId!, gdQuality, 3000)
            );
            if (result?.data?.data?.url && !result.data.data.freeTrialInfo) return result;
          }
          return null;
        }
      });
    }
    return resolveKugouPlaybackFallback(data, sources);
  }

  async parse(id: number, data: SongResult, quality = '999'): Promise<MusicParseResult | null> {
    // 仅处理跨平台歌曲
    if (!isCrossPlatformSong(data)) {
      return null;
    }

    const platform = data.platform!;
    const platformId = data.platformId!;

    // Imported songs keep their exact Kugou hash. Try the account's own playable
    // version first, then retain the existing cross-platform fallback strategy.
    if (platform === 'kugou' && data.kugou && isElectron && /^[a-f0-9]{32}$/i.test(platformId)) {
      try {
        const result = (await window.electron.ipcRenderer.invoke('kugou:song-url', {
          hash: platformId,
          albumId: data.kugou.albumId,
          albumAudioId: data.kugou.albumAudioId,
          quality:
            quality === 'standard'
              ? '128'
              : quality === 'lossless' || quality === '999'
                ? 'flac'
                : '320'
        })) as KugouSongUrl;
        if (result?.url && !isRejectedKugouPlaybackUrl(data, result.url)) {
          return {
            data: { code: 200, message: 'Kugou', data: { url: result.url, br: result.bitrate } }
          };
        }
      } catch {
        // A restricted/unavailable track may still have a matching source in the
        // existing player. Account credentials remain in the main process.
      }
    }

    // 跨平台歌曲的失败缓存使用 platformId 作为 key 的一部分
    const failCacheKey = Number(
      String(platformId)
        .split('')
        .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0)
    );
    if (!data.kugou && CacheManager.isInFailedCache(failCacheKey, this.name)) {
      return null;
    }

    const brMap: Record<string, string> = {
      lossless: '999',
      high: '320',
      higher: '320',
      standard: '128'
    };
    const br = brMap[quality] || '999';

    try {
      // ==================== 1. unblockMusic 指定平台 ====================
      // 仅在原始平台搜索，确保匹配的歌曲来自正确的平台
      if (CrossPlatformStrategy.UNBLOCK_PLATFORMS.includes(platform)) {
        const fallbackData = data.kugou
          ? { ...data, name: stripAudioFileExtension(data.name) }
          : data;
        const result = await this.tryUnblockMusic(fallbackData, platform);
        if (result?.data?.data?.url && !isRejectedKugouPlaybackUrl(data, result.data.data.url))
          return result;
      }

      // ==================== 2. GD 音乐台直链获取（仅限支持的平台） ====================
      // GD 音乐台支持 joox/kuwo/netease，可以直接用 platformId 获取 URL
      if (CrossPlatformStrategy.GD_SUPPORTED_PLATFORMS.includes(platform)) {
        console.log(`[CrossPlatformStrategy] 尝试 GD 音乐台直链: ${platform}/${platformId}`);
        const result = await getUrlByPlatform(platform, platformId, br);
        const adapted = adaptParseResult(result);
        if (adapted?.data?.data?.url) {
          console.log(`[CrossPlatformStrategy] GD 音乐台直链解析成功`);
          return adapted;
        }
      }

      // ==================== 3. GD 音乐台精确搜索匹配（最终手段） ====================
      // 对于 GD 不支持的平台（如 qq/migu/kugou），或直链失败时，
      // 用歌名+歌手在 joox 搜索（joox 曲库与 QQ 高度重合），
      // 然后做精确匹配（歌名完全一致 + 歌手匹配），确保返回的是正确的歌曲
      console.log(`[CrossPlatformStrategy] 尝试 GD 音乐台精确搜索匹配 (joox)`);
      const searchResult = data.kugou
        ? await this.tryImportedKugouFallback(data, br, quality)
        : await this.tryGdMusicSearchMatch(data, br);
      if (searchResult) {
        return searchResult;
      }

      console.warn(`[CrossPlatformStrategy] 所有解析方式均失败: ${platform}/${platformId}`);
      CacheManager.addFailedCache(failCacheKey, this.name);
      return null;
    } catch (error) {
      console.error('[CrossPlatformStrategy] 解析失败:', error);
      CacheManager.addFailedCache(failCacheKey, this.name);
      return null;
    }
  }
}

/**
 * 音源策略工厂
 */
export class MusicSourceStrategyFactory {
  private static strategies: MusicSourceStrategy[] = [
    new CrossPlatformStrategy(),
    new LxMusicStrategy(),
    new CustomApiStrategy(),
    new GDMusicStrategy(),
    new UnblockMusicStrategy()
  ];

  /**
   * 获取可用的解析策略
   * @param sources 音源列表
   * @param settingsStore 设置存储
   * @returns 排序后的可用策略列表
   */
  static getAvailableStrategies(sources: string[], settingsStore?: any): MusicSourceStrategy[] {
    return this.strategies
      .filter((strategy) => strategy.canHandle(sources, settingsStore))
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * 获取跨平台策略实例（用于直接调用，不经过 sources 过滤）
   */
  static getCrossPlatformStrategy(): CrossPlatformStrategy {
    return new CrossPlatformStrategy();
  }
}

/**
 * 获取音源配置
 * @param id 歌曲ID
 * @param settingsStore 设置存储
 * @returns 音源列表和音质设置
 */
export const getMusicConfig = (id: number | string, settingsStore?: any) => {
  let musicSources: string[] = [];
  let quality = 'higher';

  try {
    // 尝试获取歌曲自定义音源（使用 SongSourceConfigManager）
    const songConfig = SongSourceConfigManager.getConfig(id);
    if (songConfig && songConfig.sources.length > 0) {
      musicSources = songConfig.sources;
    }

    // 如果没有自定义音源，使用全局设置
    if (musicSources.length === 0) {
      musicSources = settingsStore?.setData?.enabledMusicSources || [];
    }

    quality = settingsStore?.setData?.musicQuality || 'higher';
  } catch (error) {
    console.error('读取音源配置失败，使用默认配置:', error);
    musicSources = [];
    quality = 'higher';
  }

  return { musicSources, quality };
};

/**
 * 音乐解析器主类
 */
export class MusicParser {
  /**
   * 解析音乐URL
   * @param id 歌曲ID
   * @param data 歌曲数据
   * @returns 解析结果
   */
  static async parseMusic(id: number, data: SongResult): Promise<MusicParseResult> {
    const startTime = performance.now();

    try {
      const bound = getKugouPlaybackBinding(data);
      if (bound) {
        try {
          const { getSongUrl } = await import('@/hooks/usePlayerHooks');
          const url = await getSongUrl(bound.id, bound, false);
          if (typeof url === 'string' && url && !isRejectedKugouPlaybackUrl(data, url)) {
            return { data: { code: 200, message: 'Selected version', data: { url } } };
          }
        } catch {
          // A user-selected recording must never silently change to another one.
        }
        return { data: { code: 404, message: '所选歌曲版本暂时无法播放' } };
      }

      // ==================== 跨平台歌曲专用路径 ====================
      // 跨平台歌曲（platform + platformId）直接通过 GD 音乐台获取 URL，
      // 不经过网易云 API 和常规策略链
      if (isCrossPlatformSong(data)) {
        const crossStrategy = MusicSourceStrategyFactory.getCrossPlatformStrategy();
        try {
          const quality = data.kugou ? useSettingsStore().setData.musicQuality || 'higher' : '999';
          const result = await crossStrategy.parse(id, data, quality);
          if (result?.data?.data?.url) {
            return result;
          }
        } catch (error) {
          console.error('[MusicParser] 跨平台解析失败:', error);
        }

        // 跨平台歌曲没有网易云 ID，无法回退到网易云 API
        return {
          data: {
            code: 404,
            message: '跨平台歌曲解析失败',
            data: undefined
          }
        };
      }

      // 非Electron环境直接使用API请求
      if (!isElectron) {
        return await requestMusic.get<any>('/music', { params: { id } });
      }

      // 获取设置存储
      let settingsStore: any;
      try {
        settingsStore = useSettingsStore();
      } catch (error) {
        console.error('无法获取设置存储，使用后备方案:', error);
        return await requestMusic.get<any>('/music', { params: { id } });
      }

      // 获取音源配置
      const { musicSources, quality } = getMusicConfig(id, settingsStore);

      // 检查缓存（传入音源配置用于验证缓存有效性）
      const cachedResult = await CacheManager.getCachedMusicUrl(id, musicSources);
      if (cachedResult) {
        const endTime = performance.now();
        return cachedResult;
      }

      // 检查音乐解析功能是否启用
      if (!settingsStore?.setData?.enableMusicUnblock) {
        return {
          data: {
            code: 404,
            message: '音乐解析功能已禁用',
            data: undefined
          }
        };
      }

      if (musicSources.length === 0) {
        console.warn('没有配置可用的音源，使用后备方案');
        return await requestMusic.get<any>('/music', { params: { id } });
      }

      // 获取可用的解析策略
      const availableStrategies = MusicSourceStrategyFactory.getAvailableStrategies(
        musicSources,
        settingsStore
      );

      if (availableStrategies.length === 0) {
        console.warn('没有可用的解析策略，使用后备方案');
        return await requestMusic.get<any>('/music', { params: { id } });
      }

      // 按优先级依次尝试解析策略
      for (const strategy of availableStrategies) {
        try {
          const result = await strategy.parse(id, data, quality, musicSources);
          if (result?.data?.data?.url) {
            const endTime = performance.now();

            // 缓存成功结果（包含音源配置）
            await CacheManager.setCachedMusicUrl(id, result, musicSources);

            return result;
          }
        } catch (error) {
          console.error(`策略 ${strategy.name} 解析异常:`, error);
          // 继续尝试下一个策略
        }
      }

      console.warn('所有解析策略都失败了，使用后备方案');
    } catch (error) {
      console.error('MusicParser.parseMusic 执行异常，使用后备方案:', error);
    }

    // 后备方案：使用API请求
    try {
      const result = await requestMusic.get<any>('/music', { params: { id } });

      // 如果后备方案成功，也进行缓存
      if (result?.data?.data?.url) {
        await CacheManager.setCachedMusicUrl(id, result, []);
      }

      return result;
    } catch (apiError) {
      console.error('API请求也失败了:', apiError);
      const endTime = performance.now();
      return {
        data: {
          code: 500,
          message: '所有解析方式都失败了',
          data: undefined
        }
      };
    }
  }
}
