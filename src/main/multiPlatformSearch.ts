/**
 * 多平台搜索引擎（主进程）
 *
 * 直接调用各平台公开搜索 API，返回完整的搜索结果列表。
 * 与 unblockMusic 的区别：
 * - unblockMusic 的 provider.search() 内部用 select() 做了匹配，只返回单个结果
 * - 本模块返回完整列表，供前端展示和选择
 *
 * Cookie 管理：
 * - QQ音乐：process.env.QQ_COOKIE (uin=xxx; qm_keyst=xxx)
 * - 咪咕：process.env.MIGU_COOKIE (aversionid=xxx)
 * - JOOX：process.env.JOOX_COOKIE (wmid=xxx; session_key=xxx)
 * - 酷狗/酷我：无需 Cookie
 */

import Store from 'electron-store';
import fetch from 'node-fetch';

const store = new Store();

// ==================== 类型定义 ====================

export type SearchPlatform = 'qq' | 'migu' | 'kugou' | 'kuwo' | 'joox';

export interface PlatformSong {
  /** 平台歌曲 ID（用于播放时匹配） */
  id: string;
  /** 歌曲名 */
  name: string;
  /** 歌手名列表 */
  artists: string[];
  /** 专辑名 */
  album: string;
  /** 时长（毫秒） */
  duration: number;
  /** 封面图 URL */
  picUrl?: string;
  /** 平台标识 */
  platform: SearchPlatform;
  /** 平台原始 ID（可能和 id 相同，也可能不同，如 QQ 的 songmid） */
  platformId: string;
}

export interface MultiPlatformSearchResult {
  platform: SearchPlatform;
  songs: PlatformSong[];
  error?: string;
}

// ==================== Cookie 管理 ====================

/**
 * 平台 Cookie 配置
 */
export interface PlatformCookieConfig {
  cookie: string;
  /** 过期时间戳（毫秒），0 表示未知 */
  expiresAt: number;
  /** 更新时间戳 */
  updatedAt: number;
}

/**
 * 从 electron-store 读取平台 Cookie 并注入到 process.env
 * 应在应用启动时调用
 */
export function loadPlatformCookies(): void {
  const setData = store.get('set') as any;
  const cookies = setData?.platformCookies || {};

  if (cookies.qq?.cookie) {
    process.env.QQ_COOKIE = cookies.qq.cookie;
  }
  if (cookies.migu?.cookie) {
    process.env.MIGU_COOKIE = cookies.migu.cookie;
  }
  if (cookies.joox?.cookie) {
    process.env.JOOX_COOKIE = cookies.joox.cookie;
  }
}

/**
 * 设置平台 Cookie（同时更新 process.env 和 electron-store）
 */
export function setPlatformCookie(platform: SearchPlatform, cookie: string): void {
  // 更新 process.env
  const envMap: Record<string, string> = {
    qq: 'QQ_COOKIE',
    migu: 'MIGU_COOKIE',
    joox: 'JOOX_COOKIE'
  };
  const envKey = envMap[platform];
  if (envKey) {
    if (cookie) {
      process.env[envKey] = cookie;
    } else {
      delete process.env[envKey];
    }
  }

  // 更新 electron-store
  const setData = (store.get('set') as any) || {};
  if (!setData.platformCookies) {
    setData.platformCookies = {};
  }

  if (cookie) {
    setData.platformCookies[platform] = {
      cookie,
      expiresAt: 0, // 未知过期时间，由前端检测
      updatedAt: Date.now()
    } as PlatformCookieConfig;
  } else {
    delete setData.platformCookies[platform];
  }

  store.set('set', setData);
}

/**
 * 获取平台 Cookie 配置
 */
export function getPlatformCookie(platform: SearchPlatform): PlatformCookieConfig | null {
  const setData = (store.get('set') as any) || {};
  return setData.platformCookies?.[platform] || null;
}

/**
 * 获取所有平台的登录状态
 */
export function getPlatformLoginStatus(): Record<SearchPlatform, boolean> {
  const setData = (store.get('set') as any) || {};
  const cookies = setData.platformCookies || {};

  return {
    qq: Boolean(cookies.qq?.cookie),
    migu: Boolean(cookies.migu?.cookie),
    kugou: true, // 酷狗无需登录
    kuwo: true, // 酷我无需登录
    joox: Boolean(cookies.joox?.cookie)
  };
}

// ==================== 各平台搜索实现 ====================

const REQUEST_TIMEOUT = 8000;

/**
 * 通用请求函数
 */
async function requestJson(url: string, options?: any): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...options?.headers
      },
      signal: controller.signal
    });

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * QQ 音乐搜索
 */
async function searchQQ(keyword: string, limit: number): Promise<PlatformSong[]> {
  const cookie = process.env.QQ_COOKIE || '';
  const data = {
    search: {
      method: 'DoSearchForQQMusicDesktop',
      module: 'music.search.SearchCgiService',
      param: {
        num_per_page: limit,
        page_num: 1,
        query: keyword,
        search_type: 0
      }
    }
  };

  const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg?data=' + encodeURIComponent(JSON.stringify(data));
  const json = await requestJson(url, {
    headers: {
      origin: 'http://y.qq.com/',
      referer: 'http://y.qq.com/',
      cookie: cookie || undefined
    }
  });

  const list = json?.search?.data?.body?.song?.list || [];

  return list.map((song: any): PlatformSong => ({
    id: `qq:${song.mid}`,
    name: song.name || '',
    artists: (song.singer || []).map((s: any) => s.name || ''),
    album: song.album?.name || '',
    duration: (song.interval || 0) * 1000,
    picUrl: song.album?.mid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.album.mid}.jpg` : undefined,
    platform: 'qq',
    platformId: song.mid
  }));
}

/**
 * 咪咕音乐搜索
 */
async function searchMigu(keyword: string, limit: number): Promise<PlatformSong[]> {
  const aversionid = process.env.MIGU_COOKIE || '';
  const url = `https://m.music.migu.cn/migu/remoting/scr_search_tag?keyword=${encodeURIComponent(keyword)}&type=2&rows=${limit}&pgc=1`;

  const json = await requestJson(url, {
    headers: {
      origin: 'http://music.migu.cn/',
      referer: 'http://m.music.migu.cn/v3/',
      aversionid: aversionid || undefined,
      channel: '0146921'
    }
  });

  const list = json?.musics || [];

  return list.map((song: any): PlatformSong => ({
    id: `migu:${song.id}`,
    name: song.title || song.songName || '',
    artists: (song.singerName || '').split(/\s*,\s*/).filter(Boolean),
    album: song.albumName || '',
    duration: 0,
    picUrl: song.cover || undefined,
    platform: 'migu',
    platformId: String(song.id)
  }));
}

/**
 * 酷狗音乐搜索
 */
async function searchKugou(keyword: string, limit: number): Promise<PlatformSong[]> {
  const url = `http://mobilecdn.kugou.com/api/v3/search/song?keyword=${encodeURIComponent(keyword)}&page=1&pagesize=${limit}`;

  const json = await requestJson(url);

  const list = json?.data?.info || [];

  return list.map((song: any): PlatformSong => ({
    id: `kugou:${song.hash}`,
    name: song.songname || '',
    artists: (song.singername || '').split(/[、,/&]/).map((s: string) => s.trim()).filter(Boolean),
    album: song.album_name || '',
    duration: (song.duration || 0) * 1000,
    picUrl: undefined,
    platform: 'kugou',
    platformId: song.hash
  }));
}

/**
 * 酷我音乐搜索
 */
async function searchKuwo(keyword: string, limit: number): Promise<PlatformSong[]> {
  const searchKeyword = encodeURIComponent(keyword.replace(' - ', ' '));
  const url = `http://search.kuwo.cn/r.s?&correct=1&stype=comprehensive&encoding=utf8&rformat=json&mobi=1&show_copyright_off=1&searchapi=6&all=${searchKeyword}`;

  const json = await requestJson(url);

  const abslist = json?.content?.[1]?.musicpage?.abslist || [];

  return abslist.slice(0, limit).map((song: any): PlatformSong => {
    const rid = song.MUSICRID?.split('_').pop() || '';
    return {
      id: `kuwo:${rid}`,
      name: song.SONGNAME || '',
      artists: (song.ARTIST || '').split('&').map((s: string) => s.trim()).filter(Boolean),
      album: song.ALBUM || '',
      duration: (song.DURATION || 0) * 1000,
      picUrl: undefined,
      platform: 'kuwo',
      platformId: rid
    };
  });
}

/**
 * JOOX 搜索
 */
async function searchJoox(keyword: string, limit: number): Promise<PlatformSong[]> {
  const cookie = process.env.JOOX_COOKIE || '';
  const ein = Math.min(limit, 30);
  const url = `http://api-jooxtt.sanook.com/web-fcgi-bin/web_search?country=hk&lang=zh_TW&search_input=${encodeURIComponent(keyword)}&sin=0&ein=${ein}`;

  const text = await requestJson(url, {
    headers: {
      origin: 'http://www.joox.com',
      referer: 'http://www.joox.com',
      cookie: cookie || undefined
    }
  });

  // JOOX 返回的是单引号 JSON，需要替换
  let json: any;
  if (typeof text === 'string') {
    json = JSON.parse(text.replace(/'/g, '"'));
  } else {
    json = text;
  }

  const list = json?.itemlist || [];

  // base64 解码辅助
  const decode64 = (str: string): string => {
    try {
      return Buffer.from(str || '', 'base64').toString('utf-8');
    } catch {
      return '';
    }
  };

  return list.map((song: any): PlatformSong => ({
    id: `joox:${song.songid}`,
    name: decode64(song.info1 || ''),
    artists: (song.singer_list || []).map((s: any) => decode64(s.name || '')),
    album: decode64(song.info3 || ''),
    duration: (song.playtime || 0) * 1000,
    picUrl: song.songmid ? `http://img.joox.com/musicphoto/${song.songmid}.jpg` : undefined,
    platform: 'joox',
    platformId: String(song.songid)
  }));
}

// ==================== 搜索调度 ====================

const SEARCH_FUNCTIONS: Record<SearchPlatform, (keyword: string, limit: number) => Promise<PlatformSong[]>> = {
  qq: searchQQ,
  migu: searchMigu,
  kugou: searchKugou,
  kuwo: searchKuwo,
  joox: searchJoox
};

/**
 * 在指定平台搜索
 */
export async function searchOnPlatform(
  platform: SearchPlatform,
  keyword: string,
  limit: number = 20
): Promise<MultiPlatformSearchResult> {
  try {
    if (!keyword.trim()) {
      return { platform, songs: [] };
    }

    const searchFn = SEARCH_FUNCTIONS[platform];
    const songs = await searchFn(keyword, limit);
    return { platform, songs };
  } catch (error: any) {
    console.error(`[multiPlatformSearch] ${platform} 搜索失败:`, error.message);
    return { platform, songs: [], error: error.message };
  }
}

/**
 * 多平台并发搜索
 * @param keyword 搜索关键词
 * @param platforms 要搜索的平台列表
 * @param limit 每个平台返回的最大结果数
 * @returns 各平台搜索结果
 */
export async function multiPlatformSearch(
  keyword: string,
  platforms: SearchPlatform[],
  limit: number = 20
): Promise<MultiPlatformSearchResult[]> {
  if (!keyword.trim() || platforms.length === 0) {
    return [];
  }

  const promises = platforms.map((platform) => searchOnPlatform(platform, keyword, limit));
  return Promise.all(promises);
}
