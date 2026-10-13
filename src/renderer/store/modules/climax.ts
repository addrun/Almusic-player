/**
 * 高潮段落状态管理 (Climax Store)
 *
 * 集中管理高潮段落数据，供播放条、编辑器、舞台播放器等组件使用
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { type ClimaxSegment,loadClimaxForSong } from '@/api/climax';
import { getLocalClimax } from '@/services/cacheService';

export const useClimaxStore = defineStore('climax', () => {
  // 当前歌曲的高潮段落
  const segments = ref<ClimaxSegment[]>([]);

  // 当前歌曲ID
  const currentSongId = ref<string>('');

  // 贡献者信息
  const contributor = ref<string | null>(null);

  // 加载状态
  const loading = ref(false);

  /**
   * 加载指定歌曲的高潮段落
   */
  async function loadSegments(songId: string) {
    if (!songId || songId === currentSongId.value) return;

    loading.value = true;
    currentSongId.value = songId;

    try {
      // 本地歌曲：从本地永久存储加载
      if (!/^\d+$/.test(songId)) {
        const localData = await getLocalClimax(songId);
        segments.value = localData?.segments || [];
        contributor.value = localData?.contributor || null;
      } else {
        const result = await loadClimaxForSong(songId);
        segments.value = result.segments || [];
        contributor.value = result.contributor || null;
      }
    } catch (err) {
      console.error('[ClimaxStore] 加载高潮数据失败:', err);
      segments.value = [];
      contributor.value = null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 检查指定时间是否在高潮段落内
   */
  function isTimeInClimax(time: number): boolean {
    return segments.value.some((seg) => time >= seg.start && time <= seg.end);
  }

  /**
   * 获取当前时间所在的高潮段落
   */
  function getCurrentSegment(time: number): ClimaxSegment | null {
    return segments.value.find((seg) => time >= seg.start && time <= seg.end) || null;
  }

  /**
   * 清空数据（切歌时调用）
   */
  function clear() {
    segments.value = [];
    currentSongId.value = '';
    contributor.value = null;
  }

  /**
   * 更新段落数据（编辑器保存后调用）
   */
  function updateSegments(newSegments: ClimaxSegment[]) {
    segments.value = newSegments;
  }

  // 计算属性
  const hasSegments = computed(() => segments.value.length > 0);

  return {
    segments,
    currentSongId,
    contributor,
    loading,
    hasSegments,
    loadSegments,
    isTimeInClimax,
    getCurrentSegment,
    clear,
    updateSegments,
  };
});
