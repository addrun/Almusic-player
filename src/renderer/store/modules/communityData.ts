/**
 * 社区数据 Store (CommunityData)
 *
 * 管理高潮段落、重点词、社区歌词的加载和缓存
 * 数据流: IndexedDB 缓存 → API 请求 → 缓存
 */

import { defineStore } from 'pinia';
import { computed,ref } from 'vue';

import { type ClimaxSegment,loadClimaxForSong } from '@/api/climax';
import { type CommunityLyric,loadCommunityLyricForSong } from '@/api/communityLyric';
import { type KeywordMark,loadKeywordsForSong } from '@/api/keywords';
import {
  getClimaxCache,
  getCommunityLyricCache,
  getKeywordsCache,
  getLocalClimax,
  saveClimaxCache,
  saveCommunityLyricCache,
  saveKeywordsCache} from '@/services/cacheService';

export const useCommunityDataStore = defineStore('communityData', () => {
  // ==================== State ====================
  const currentSongId = ref<string>('');

  // 判断 songId 是否为本地歌曲（本地歌曲 ID 是字符串路径哈希，非数字）
  function isLocalSongId(songId: string): boolean {
    return !/^\d+$/.test(songId);
  }
  // Climax
  const climaxSegments = ref<ClimaxSegment[]>([]);
  const climaxContributor = ref<string | null>(null);

  // Keywords
  const keywordMark = ref<KeywordMark | null>(null);

  // Community Lyric
  const communityLyric = ref<CommunityLyric | null>(null);

  // Loading states
  const loadingClimax = ref(false);
  const loadingKeywords = ref(false);
  const loadingLyric = ref(false);

  // ==================== Actions ====================

  /**
   * 加载歌曲的社区数据（缓存优先）
   * 流程: 高潮段落 → 重点词 → 社区歌词
   * 每一步只有在前置数据存在时才继续
   */
  async function loadAll(songId: string) {
    if (!songId || songId === currentSongId.value) {
      return;
    }

    currentSongId.value = songId;
    climaxSegments.value = [];
    climaxContributor.value = null;
    keywordMark.value = null;
    communityLyric.value = null;

    await loadClimax(songId);

    if (climaxSegments.value.length > 0) {
      await loadKeywords(songId);
    } else {
    }

    await loadCommunityLyric(songId);
  }

  /**
   * 加载高潮段落（缓存优先）
   * 缓存包含空数组，避免重复请求不存在的数据
   */
  async function loadClimax(songId: string) {
    loadingClimax.value = true;
    try {
      // 本地歌曲：从本地永久存储加载，不走服务器
      if (isLocalSongId(songId)) {
        const localData = await getLocalClimax(songId);
        if (localData) {
          climaxSegments.value = localData.segments;
          climaxContributor.value = localData.contributor;
        } else {
          climaxSegments.value = [];
          climaxContributor.value = null;
        }
        return;
      }

      // 在线歌曲：缓存优先
      const cached = await getClimaxCache(songId);
      if (cached != null) {
        climaxSegments.value = cached.segments;
        climaxContributor.value = cached.contributor;
        return;
      }

      const result = await loadClimaxForSong(songId);
      climaxSegments.value = result.segments || [];
      climaxContributor.value = result.contributor || null;

      await saveClimaxCache(songId, {
        segments: result.segments,
        contributor: result.contributor
      });
    } catch (err) {
      console.error('[CommunityData] loadClimax error:', err);
      climaxSegments.value = [];
      climaxContributor.value = null;
    } finally {
      loadingClimax.value = false;
    }
  }

  /**
   * 加载重点词（缓存优先）
   * 不缓存 null 值，允许后续上传后重新获取
   */
  async function loadKeywords(songId: string) {
    loadingKeywords.value = true;
    try {
      const cached = await getKeywordsCache(songId);
      if (cached != null) {
        keywordMark.value = cached;
        return;
      }

      const result = await loadKeywordsForSong(songId);
      keywordMark.value = result;

      // 只缓存有数据的结果，不缓存 null
      if (result) {
        await saveKeywordsCache(songId, result);
      }
    } catch (err) {
      console.error('[CommunityData] loadKeywords error:', err);
      keywordMark.value = null;
    } finally {
      loadingKeywords.value = false;
    }
  }

  /**
   * 加载社区歌词（缓存优先）
   * 不缓存 null 值，允许后续上传后重新获取
   */
  async function loadCommunityLyric(songId: string) {
    loadingLyric.value = true;
    try {
      const cached = await getCommunityLyricCache(songId);
      if (cached != null) {
        communityLyric.value = cached;
        return;
      }

      const result = await loadCommunityLyricForSong(songId);
      communityLyric.value = result;

      // 只缓存有数据的结果，不缓存 null
      if (result) {
        await saveCommunityLyricCache(songId, result);
      }
    } catch (err) {
      console.error('[CommunityData] 加载社区歌词失败:', err);
      communityLyric.value = null;
    } finally {
      loadingLyric.value = false;
    }
  }

  /**
   * 清空数据（切歌时调用）
   */
  function clear() {
    currentSongId.value = '';
    climaxSegments.value = [];
    climaxContributor.value = null;
    keywordMark.value = null;
    communityLyric.value = null;
  }

  /**
   * 获取指定行的重点词
   */
  function getKeywordsForLine(lineIndex: number) {
    if (!keywordMark.value) return [];
    const line = keywordMark.value.lines.find(l => l.lineIndex === lineIndex);
    return line?.words ?? [];
  }

  // ==================== Computed ====================
  const hasClimax = computed(() => climaxSegments.value.length > 0);
  const hasKeywords = computed(() => keywordMark.value !== null && keywordMark.value.lines.length > 0);
  const hasCommunityLyric = computed(() => communityLyric.value !== null);

  return {
    currentSongId,
    climaxSegments,
    climaxContributor,
    keywordMark,
    communityLyric,
    loadingClimax,
    loadingKeywords,
    loadingLyric,
    hasClimax,
    hasKeywords,
    hasCommunityLyric,
    loadAll,
    loadClimax,
    loadKeywords,
    loadCommunityLyric,
    clear,
    getKeywordsForLine
  };
});
