/**
 * 跨平台搜索聚合模块
 *
 * 职责：
 * 1. 当网易云搜索结果不足或为空时，调用多平台搜索进行补充
 * 2. 将各平台搜索结果统一映射为 SongResult 格式
 * 3. 与网易云结果去重（按歌名+歌手匹配）
 *
 * 两条搜索通道：
 * - 原生多平台搜索（通过主进程 IPC，支持 QQ/咪咕/酷狗/酷我/JOOX，可使用 Cookie 解锁高品质）
 * - GD 音乐台搜索（作为 fallback，仅支持 joox/kuwo/netease）
 *
 * 注意：GD 音乐台不支持 tencent/qq 音源（返回 400），
 * joox 是 QQ 音乐的国际版，曲库覆盖高度重合。
 */

import { searchFromGDMusic, type GDCrossPlatformSearchItem } from './gdmusic';

import type { Artist, SongResult } from '@/types/music';

/**
 * 跨平台搜索配置
 */
export interface CrossPlatformSearchConfig {
  /** 触发跨平台搜索的网易云结果数量阈值（少于该值时触发） */
  minNeteaseResults?: number;
  /** 每个音源返回的最大结果数 */
  perSourceLimit?: number;
  /** 是否启用 kuwo 音源（搜索可用但 URL 解析可能失败） */
  enableKuwo?: boolean;
  /** 是否使用原生多平台搜索（主进程 IPC） */
  useNativeSearch?: boolean;
  /** 原生搜索的平台列表 */
  nativePlatforms?: string[];
}

const DEFAULT_CONFIG: Required<CrossPlatformSearchConfig> = {
  minNeteaseResults: 5,
  perSourceLimit: 20,
  enableKuwo: false, // kuwo URL 解析不稳定，默认关闭
  useNativeSearch: true,
  nativePlatforms: ['qq', 'migu', 'kugou', 'kuwo', 'joox']
};

/**
 * GD 音乐台跨平台音源优先级
 * joox 优先（覆盖 QQ 独占内容且 URL 解析稳定）
 */
const CROSS_PLATFORM_SOURCES = ['joox'] as const;

/**
 * 判断是否需要触发跨平台搜索
 * @param neteaseResultCount 网易云搜索结果数量
 * @param config 配置
 */
export function shouldTriggerCrossSearch(
  neteaseResultCount: number,
  config?: CrossPlatformSearchConfig
): boolean {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return neteaseResultCount < cfg.minNeteaseResults;
}

/**
 * 生成跨平台歌曲的唯一 ID
 * 格式：platform:platformId（确保不与网易云数字 ID 冲突）
 */
function makeCrossPlatformId(platform: string, platformId: string): string {
  return `${platform}:${platformId}`;
}

/**
 * 将 GD 音乐台搜索结果项转换为 SongResult 格式
 */
function convertGdItemToSongResult(
  item: GDCrossPlatformSearchItem,
  platform: string
): SongResult {
  const artists: Artist[] = (item.artist || []).map((name, idx) => ({
    name,
    id: idx, // 跨平台歌曲无可靠艺术家 ID
    picId: 0,
    img1v1Id: 0,
    briefDesc: '',
    picUrl: '',
    img1v1Url: '',
    albumSize: 0,
    alias: [],
    trans: '',
    musicSize: 0,
    topicPerson: 0
  }));

  const album = {
    name: item.album || '',
    id: 0,
    type: '',
    size: 0,
    picId: 0,
    blurPicUrl: '',
    companyId: 0,
    pic: 0,
    picUrl: '',
    publishTime: 0,
    description: '',
    tags: '',
    company: '',
    briefDesc: '',
    artist: artists[0] || ({} as Artist),
    songs: [],
    alias: [],
    status: 0,
    copyrightId: 0,
    commentThreadId: '',
    artists,
    subType: '',
    transName: null,
    onSale: false,
    mark: 0,
    picId_str: ''
  };

  const crossId = makeCrossPlatformId(platform, String(item.url_id || item.id));

  return {
    id: crossId,
    name: item.name || '未知歌曲',
    picUrl: '',
    ar: artists,
    artists,
    al: album,
    album,
    count: 0,
    platform,
    platformId: String(item.url_id || item.id),
    source: 'netease' as any // 保持兼容，实际来源通过 platform 字段判断
  };
}

/**
 * 主进程返回的原生搜索结果项
 */
interface NativePlatformSong {
  id: string;
  name: string;
  artists: string[];
  album: string;
  duration: number;
  picUrl?: string;
  platform: string;
  platformId: string;
}

/**
 * 将主进程原生搜索结果转换为 SongResult
 */
function convertNativeItemToSongResult(item: NativePlatformSong): SongResult {
  const artists: Artist[] = (item.artists || []).map((name, idx) => ({
    name,
    id: idx,
    picId: 0,
    img1v1Id: 0,
    briefDesc: '',
    picUrl: '',
    img1v1Url: '',
    albumSize: 0,
    alias: [],
    trans: '',
    musicSize: 0,
    topicPerson: 0
  }));

  const album = {
    name: item.album || '',
    id: 0,
    type: '',
    size: 0,
    picId: 0,
    blurPicUrl: '',
    companyId: 0,
    pic: 0,
    picUrl: item.picUrl || '',
    publishTime: 0,
    description: '',
    tags: '',
    company: '',
    briefDesc: '',
    artist: artists[0] || ({} as Artist),
    songs: [],
    alias: [],
    status: 0,
    copyrightId: 0,
    commentThreadId: '',
    artists,
    subType: '',
    transName: null,
    onSale: false,
    mark: 0,
    picId_str: ''
  };

  const crossId = makeCrossPlatformId(item.platform, item.platformId);

  return {
    id: crossId,
    name: item.name || '未知歌曲',
    picUrl: item.picUrl || '',
    ar: artists,
    artists,
    al: album,
    album,
    count: item.duration || 0,
    platform: item.platform,
    platformId: item.platformId,
    source: 'netease' as any
  };
}

/**
 * 生成歌曲去重 key（歌名+歌手，小写）
 */
function makeDedupKey(name: string, artists: string[]): string {
  const artistStr = artists.join(',').toLowerCase().trim();
  return `${(name || '').toLowerCase().trim()}|${artistStr}`;
}

/**
 * 从 SongResult 提取去重 key
 */
function getDedupKey(song: SongResult): string {
  const artists =
    song.ar?.map((a) => a.name) || song.artists?.map((a) => a.name) || [];
  return makeDedupKey(song.name, artists);
}

/**
 * 原生多平台搜索（通过主进程 IPC）
 *
 * @param keyword 搜索关键词
 * @param platforms 平台列表
 * @param limit 每个平台返回的最大结果数
 * @returns 转换后的 SongResult 列表
 */
async function nativeMultiPlatformSearch(
  keyword: string,
  platforms: string[],
  limit: number
): Promise<SongResult[]> {
  if (!window.api?.multiPlatformSearch) {
    console.warn('[nativeSearch] window.api.multiPlatformSearch 不可用');
    return [];
  }

  try {
    console.log(`[nativeSearch] 开始搜索: keyword="${keyword}", platforms=[${platforms.join(',')}], limit=${limit}`);
    const results = await window.api.multiPlatformSearch(keyword, platforms, limit);

    const songs: SongResult[] = [];
    for (const result of results) {
      if (result.error) {
        console.warn(`[nativeSearch] ${result.platform} 搜索失败: ${result.error}`);
        continue;
      }
      console.log(`[nativeSearch] ${result.platform} 返回 ${result.songs.length} 条结果`);
      for (const item of result.songs) {
        songs.push(convertNativeItemToSongResult(item as NativePlatformSong));
      }
    }
    console.log(`[nativeSearch] 总计获取 ${songs.length} 条跨平台结果`);
    return songs;
  } catch (error) {
    console.error('[nativeSearch] 多平台搜索失败:', error);
    return [];
  }
}

/**
 * GD 音乐台搜索（作为 fallback）
 */
async function gdMusicSearch(
  keyword: string,
  sources: readonly string[],
  limit: number
): Promise<SongResult[]> {
  const searchPromises = sources.map(async (source) => {
    try {
      const items = await searchFromGDMusic(source, keyword, limit, 1);
      return { source, items };
    } catch (error) {
      console.error(`[gdMusicSearch] ${source} 搜索失败:`, error);
      return { source, items: [] as GDCrossPlatformSearchItem[] };
    }
  });

  const results = await Promise.all(searchPromises);

  const songs: SongResult[] = [];
  for (const { source, items } of results) {
    for (const item of items) {
      songs.push(convertGdItemToSongResult(item, source));
    }
  }
  return songs;
}

/**
 * 跨平台搜索（聚合多音源）
 *
 * 优先使用原生多平台搜索（主进程 IPC），若不可用则回退到 GD 音乐台。
 *
 * @param keyword 搜索关键词
 * @param existingSongs 已有的网易云搜索结果（用于去重）
 * @param config 搜索配置
 * @returns 跨平台搜索结果（已去重、已转换格式）
 */
export async function crossPlatformSearch(
  keyword: string,
  existingSongs: SongResult[] = [],
  config?: CrossPlatformSearchConfig
): Promise<SongResult[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!keyword || !keyword.trim()) {
    return [];
  }

  // 构建已存在歌曲的去重 key 集合
  const existingKeys = new Set<string>();
  for (const song of existingSongs) {
    existingKeys.add(getDedupKey(song));
  }

  // 获取搜索结果
  let rawSongs: SongResult[] = [];

  if (cfg.useNativeSearch && window.api?.multiPlatformSearch) {
    // 原生多平台搜索
    const platforms = [...cfg.nativePlatforms];
    if (!cfg.enableKuwo) {
      const kuwoIdx = platforms.indexOf('kuwo');
      if (kuwoIdx > -1) platforms.splice(kuwoIdx, 1);
    }
    rawSongs = await nativeMultiPlatformSearch(keyword, platforms, cfg.perSourceLimit);
  }

  // 如果原生搜索无结果，回退到 GD 音乐台
  if (rawSongs.length === 0) {
    const sources: string[] = [...CROSS_PLATFORM_SOURCES];
    if (cfg.enableKuwo) {
      sources.push('kuwo');
    }
    rawSongs = await gdMusicSearch(keyword, sources, cfg.perSourceLimit);
  }

  // 去重
  const mergedSongs: SongResult[] = [];
  const seenKeys = new Set<string>(existingKeys);

  for (const song of rawSongs) {
    const key = getDedupKey(song);

    // 去重：跳过与网易云结果重复的歌曲，以及跨平台内部重复
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    mergedSongs.push(song);
  }

  return mergedSongs;
}

/**
 * 判断歌曲是否为跨平台歌曲
 */
export function isCrossPlatformSong(song: SongResult | null | undefined): boolean {
  if (!song) return false;
  return Boolean(song.platform && song.platform !== 'netease' && song.platformId);
}

/**
 * 获取跨平台歌曲的显示名称
 */
export function getCrossPlatformDisplayName(platform: string): string {
  switch (platform) {
    case 'qq':
      return 'QQ 音乐';
    case 'migu':
      return '咪咕';
    case 'joox':
      return 'JOOX';
    case 'kuwo':
      return '酷我';
    case 'kugou':
      return '酷狗';
    case 'netease':
      return '网易云';
    default:
      return platform;
  }
}
