/**
 * 社区数据缓存服务
 *
 * 基于 IndexedDB 缓存高潮段落、重点词、社区歌词
 * 缓存 TTL: 24 小时
 * 注意: 缓存包含 null 值，避免重复请求不存在的数据
 */

import type { ClimaxSegment } from '@/api/climax';
import type { CommunityLyric } from '@/api/communityLyric';
import type { KeywordMark } from '@/api/keywords';
import { getMusicDB } from '@/hooks/MusicHook';

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

/**
 * 检查缓存是否有效
 */
function isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  if (!entry || !('data' in entry) || !('cachedAt' in entry)) return false;
  return Date.now() - entry.cachedAt < CACHE_TTL;
}

/**
 * 保存缓存
 */
async function saveCache<T>(storeName: string, key: string, data: T): Promise<void> {
  try {
    const db = await getMusicDB();
    await db.saveData(storeName as any, {
      id: key,
      data,
      cachedAt: Date.now()
    } as any);
  } catch (err) {
    console.error(`[CacheService] 保存缓存失败 (${storeName}):`, err);
  }
}

/**
 * 读取缓存
 * 返回值: data | null (缓存了null) | undefined (缓存未命中)
 */
async function getCache<T>(storeName: string, key: string): Promise<T | null | undefined> {
  try {
    const db = await getMusicDB();
    const entry = await db.getData(storeName as any, key) as CacheEntry<T> | undefined;
    if (!entry) return undefined; // 缓存未命中
    if (!isCacheValid(entry)) return undefined; // 缓存过期
    return entry.data; // 返回 data（可能为 null）
  } catch {
    return undefined;
  }
}

/**
 * 删除缓存
 */
async function deleteCache(storeName: string, key: string): Promise<void> {
  try {
    const db = await getMusicDB();
    await db.deleteData(storeName as any, key);
  } catch (err) {
    console.error(`[CacheService] 删除缓存失败 (${storeName}):`, err);
  }
}

// ==================== Climax Cache ====================

export interface ClimaxCacheData {
  segments: ClimaxSegment[];
  contributor: string | null;
}

export async function getClimaxCache(songId: string): Promise<ClimaxCacheData | null | undefined> {
  return getCache<ClimaxCacheData>('climax_cache', songId);
}

export async function saveClimaxCache(songId: string, data: ClimaxCacheData): Promise<void> {
  await saveCache('climax_cache', songId, data);
}

export async function deleteClimaxCache(songId: string): Promise<void> {
  await deleteCache('climax_cache', songId);
}

// ==================== Local Climax Data (本地歌曲永久存储) ====================

/**
 * 读取本地歌曲的高潮数据（永久存储，不设 TTL）
 */
export async function getLocalClimax(songId: string): Promise<ClimaxCacheData | null | undefined> {
  try {
    const db = await getMusicDB();
    const entry = await db.getData('local_climax_data' as any, songId) as { data: ClimaxCacheData } | undefined;
    if (!entry) return undefined;
    return entry.data;
  } catch {
    return undefined;
  }
}

/**
 * 保存本地歌曲的高潮数据（永久存储）
 */
export async function saveLocalClimax(songId: string, data: ClimaxCacheData): Promise<void> {
  try {
    const db = await getMusicDB();
    await db.saveData('local_climax_data' as any, { id: songId, data } as any);
  } catch (err) {
    console.error('[CacheService] 保存本地高潮数据失败:', err);
  }
}

/**
 * 删除本地歌曲的高潮数据
 */
export async function deleteLocalClimax(songId: string): Promise<void> {
  try {
    const db = await getMusicDB();
    await db.deleteData('local_climax_data' as any, songId);
  } catch (err) {
    console.error('[CacheService] 删除本地高潮数据失败:', err);
  }
}

// ==================== Keywords Cache ====================

export async function getKeywordsCache(songId: string): Promise<KeywordMark | null | undefined> {
  return getCache<KeywordMark>('keywords_cache', songId);
}

export async function saveKeywordsCache(songId: string, data: KeywordMark | null): Promise<void> {
  await saveCache('keywords_cache', songId, data);
}

export async function deleteKeywordsCache(songId: string): Promise<void> {
  await deleteCache('keywords_cache', songId);
}

// ==================== Community Lyric Cache ====================

export async function getCommunityLyricCache(songId: string): Promise<CommunityLyric | null | undefined> {
  return getCache<CommunityLyric>('community_lyric_cache', songId);
}

export async function saveCommunityLyricCache(songId: string, data: CommunityLyric | null): Promise<void> {
  await saveCache('community_lyric_cache', songId, data);
}

export async function deleteCommunityLyricCache(songId: string): Promise<void> {
  await deleteCache('community_lyric_cache', songId);
}
