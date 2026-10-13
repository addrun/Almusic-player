import axios from 'axios';

import type { MusicSourceType, SongResult } from '@/types/music';

/**
 * GD音乐台解析服务
 */
export interface GDMusicResponse {
  url: string;
  br: number;
  size: number;
  md5: string;
  platform: string;
  gain: number;
}

export interface ParsedMusicResult {
  data: {
    data: GDMusicResponse;
    params: {
      id: number;
      type: string;
    };
  };
}

/**
 * 从GD音乐台解析音乐URL
 * @param id 音乐ID
 * @param data 音乐数据，包含名称和艺术家信息
 * @param quality 音质设置
 * @param timeout 超时时间(毫秒)，默认15000ms
 * @returns 解析后的音乐URL及相关信息
 */
export const parseFromGDMusic = async (
  id: number,
  data: any,
  quality: string = '999',
  timeout: number = 15000
): Promise<ParsedMusicResult | null> => {
  // 创建一个超时Promise
  const timeoutPromise = new Promise<null>((_, reject) => {
    setTimeout(() => {
      reject(new Error('GD音乐台解析超时'));
    }, timeout);
  });

  try {
    // 使用Promise.race竞争主解析流程和超时
    return await Promise.race([
      (async () => {
        // 处理不同数据结构
        if (!data) {
          console.error('GD音乐台解析：歌曲数据为空');
          throw new Error('歌曲数据为空');
        }

        const songName = data.name || '';
        let artistNames = '';

        // 处理不同的艺术家字段结构
        if (data.artists && Array.isArray(data.artists)) {
          artistNames = data.artists.map((artist) => artist.name).join(' ');
        } else if (data.ar && Array.isArray(data.ar)) {
          artistNames = data.ar.map((artist) => artist.name).join(' ');
        } else if (data.artist) {
          artistNames = typeof data.artist === 'string' ? data.artist : '';
        }

        const searchQuery = `${songName} ${artistNames}`.trim();

        if (!searchQuery || searchQuery.length < 2) {
          console.error('GD音乐台解析：搜索查询过短', { name: songName, artists: artistNames });
          throw new Error('搜索查询过短');
        }

        // 所有可用的音乐源 netease、joox、tidal
        const allSources = ['joox', 'tidal', 'netease'] as MusicSourceType[];


        // 依次尝试所有音源
        for (const source of allSources) {
          try {
            const result = await searchAndGetUrl(source, searchQuery, quality);
            if (result) {
              // 返回符合原API格式的数据
              return {
                data: {
                  data: {
                    url: result.url.replace(/\\/g, ''),
                    br: parseInt(result.br, 10) * 1000 || 320000,
                    size: result.size || 0,
                    md5: '',
                    platform: 'gdmusic',
                    gain: 0
                  },
                  params: {
                    id: parseInt(String(id), 10),
                    type: 'song'
                  }
                }
              };
            }
          } catch (error) {
            console.error(`GD音乐台 ${source} 音源解析失败:`, error);
            // 该音源失败，继续尝试下一个音源
            continue;
          }
        }

        return null;
      })(),
      timeoutPromise
    ]);
  } catch (error: any) {
    if (error.message === 'GD音乐台解析超时') {
      console.error('GD音乐台解析超时(15秒):', error);
    } else {
      console.error('GD音乐台解析完全失败:', error);
    }
    return null;
  }
};

interface GDMusicUrlResult {
  url: string;
  br: string;
  size: number;
  source: string;
}

const baseUrl = 'https://music-api.gdstudio.xyz/api.php';

/**
 * 在指定音源搜索歌曲并获取URL
 * @param source 音源
 * @param searchQuery 搜索关键词
 * @param quality 音质
 * @returns 音乐URL结果
 */
async function searchAndGetUrl(
  source: MusicSourceType,
  searchQuery: string,
  quality: string
): Promise<GDMusicUrlResult | null> {
  // 1. 搜索歌曲
  const searchUrl = `${baseUrl}?types=search&source=${source}&name=${encodeURIComponent(searchQuery)}&count=1&pages=1`;

  const searchResponse = await axios.get(searchUrl, { timeout: 5000 });

  if (searchResponse.data && Array.isArray(searchResponse.data) && searchResponse.data.length > 0) {
    const firstResult = searchResponse.data[0];
    if (!firstResult || !firstResult.id) {
      return null;
    }

    const trackId = firstResult.id;
    const trackSource = firstResult.source || source;

    // 2. 获取歌曲URL
    const songUrl = `${baseUrl}?types=url&source=${trackSource}&id=${trackId}&br=${quality}`;

    const songResponse = await axios.get(songUrl, { timeout: 5000 });

    if (songResponse.data && songResponse.data.url) {
      return {
        url: songResponse.data.url,
        br: songResponse.data.br,
        size: songResponse.data.size || 0,
        source: trackSource
      };
    } else {
      return null;
    }
  } else {
    return null;
  }
}

// ==================== 跨平台搜索支持 ====================

/**
 * GD 音乐台支持的跨平台搜索音源
 * 注意：tencent/qq 不被支持（返回 400），使用 joox 作为 QQ 音乐的替代
 */
export const GD_CROSS_PLATFORM_SOURCES = ['joox', 'kuwo', 'netease'] as const;

/**
 * 跨平台搜索结果项（GD 音乐台原始返回格式）
 */
export interface GDCrossPlatformSearchItem {
  id: string;
  name: string;
  artist: string[];
  album: string;
  pic_id: string;
  url_id: string;
  lyric_id: string;
  source: string;
  from?: string;
}

/**
 * 跨平台搜索结果（已转换为 SongResult 格式）
 */
export interface CrossPlatformSearchResult {
  songs: SongResult[];
  source: string;
}

/**
 * 在 GD 音乐台指定音源搜索歌曲
 * @param source 音源（joox/kuwo/netease）
 * @param keyword 搜索关键词
 * @param count 返回数量，默认 20
 * @param page 页码，默认 1
 * @returns 搜索结果列表
 */
export async function searchFromGDMusic(
  source: string,
  keyword: string,
  count: number = 20,
  page: number = 1
): Promise<GDCrossPlatformSearchItem[]> {
  const searchUrl = `${baseUrl}?types=search&source=${source}&name=${encodeURIComponent(keyword)}&count=${count}&pages=${page}`;

  const response = await axios.get(searchUrl, { timeout: 8000 });

  if (response.data && Array.isArray(response.data)) {
    return response.data as GDCrossPlatformSearchItem[];
  }

  return [];
}

/**
 * 通过平台和平台ID直接获取播放URL（无需再次搜索）
 * @param platform 平台标识（joox/kuwo/netease 等）
 * @param platformId 平台歌曲ID
 * @param quality 音质，默认 999（最高）
 * @param timeout 超时时间（毫秒）
 * @returns 解析结果，失败返回 null
 */
export const getUrlByPlatform = async (
  platform: string,
  platformId: string,
  quality: string = '999',
  timeout: number = 8000
): Promise<ParsedMusicResult | null> => {
  const timeoutPromise = new Promise<null>((_, reject) => {
    setTimeout(() => reject(new Error('跨平台URL获取超时')), timeout);
  });

  try {
    return await Promise.race([
      (async () => {
        if (!platformId) {
          throw new Error('平台ID为空');
        }

        const songUrl = `${baseUrl}?types=url&source=${platform}&id=${encodeURIComponent(platformId)}&br=${quality}`;

        const response = await axios.get(songUrl, { timeout: 5000 });

        if (response.data && response.data.url) {
          return {
            data: {
              data: {
                url: (response.data.url as string).replace(/\\/g, ''),
                br: parseInt(String(response.data.br), 10) * 1000 || 320000,
                size: response.data.size || 0,
                md5: '',
                platform,
                gain: 0
              },
              params: {
                id: 0,
                type: 'song'
              }
            }
          };
        }

        return null;
      })(),
      timeoutPromise
    ]);
  } catch (error: any) {
    if (error.message === '跨平台URL获取超时') {
      console.error('[getUrlByPlatform] 超时:', { platform, platformId });
    } else {
      console.error('[getUrlByPlatform] 失败:', error);
    }
    return null;
  }
};

/**
 * GD 音乐台歌词响应格式
 */
export interface GDMusicLyricResponse {
  lyric?: string;
  tlyric?: string;
  yrc?: string;
  yromrc?: string;
}

/**
 * 通过平台和平台ID获取歌词（GD 音乐台）
 *
 * 仅支持 joox/kuwo/netease 平台。
 * 对于 qq/migu/kugou 等不支持的平台，需先通过搜索获取匹配歌曲的 lyric_id。
 *
 * @param platform 平台标识（joox/kuwo/netease）
 * @param platformId 平台歌曲 ID（或搜索结果中的 lyric_id）
 * @param timeout 超时时间（毫秒）
 * @returns 歌词数据，失败返回 null
 */
export const getLyricByPlatform = async (
  platform: string,
  platformId: string,
  timeout: number = 8000
): Promise<GDMusicLyricResponse | null> => {
  const timeoutPromise = new Promise<null>((_, reject) => {
    setTimeout(() => reject(new Error('跨平台歌词获取超时')), timeout);
  });

  try {
    return await Promise.race([
      (async () => {
        if (!platformId) {
          throw new Error('平台ID为空');
        }

        const lyricUrl = `${baseUrl}?types=lyric&source=${platform}&id=${encodeURIComponent(platformId)}`;

        const response = await axios.get(lyricUrl, { timeout: 5000 });

        if (response.data && (response.data.lyric || response.data.yrc)) {
          return response.data as GDMusicLyricResponse;
        }

        return null;
      })(),
      timeoutPromise
    ]);
  } catch (error: any) {
    if (error.message === '跨平台歌词获取超时') {
      console.error('[getLyricByPlatform] 超时:', { platform, platformId });
    } else {
      console.error('[getLyricByPlatform] 失败:', error);
    }
    return null;
  }
};
