/**
 * 歌曲音源配置管理器
 *
 * 职责：
 * 1. 统一管理每首歌曲的自定义音源配置
 * 2. 提供清晰的读取/写入/清除 API
 * 3. 区分"手动"和"自动"设置的音源
 * 4. 管理已尝试的音源列表（按歌曲隔离）
 */

import type { Platform } from '@/types/music';

// 歌曲音源配置类型
export type SongSourceConfig = {
  sources: Platform[];
  type: 'manual' | 'auto';
  updatedAt: number;
};

// 内存中缓存已尝试的音源（按歌曲隔离）
const triedSourcesMap = new Map<string, Set<string>>();
const triedSourceDiffsMap = new Map<string, Map<string, number>>();

// localStorage key 前缀
const STORAGE_KEY_PREFIX = 'song_source_';
const STORAGE_TYPE_KEY_PREFIX = 'song_source_type_';

/**
 * 歌曲音源配置管理器
 */
export class SongSourceConfigManager {
  /**
   * 获取歌曲的自定义音源配置
   */
  static getConfig(songId: number | string): SongSourceConfig | null {
    const id = String(songId);
    const sourcesStr = localStorage.getItem(`${STORAGE_KEY_PREFIX}${id}`);
    const typeStr = localStorage.getItem(`${STORAGE_TYPE_KEY_PREFIX}${id}`);

    if (!sourcesStr) {
      return null;
    }

    try {
      const sources = JSON.parse(sourcesStr) as Platform[];
      if (!Array.isArray(sources) || sources.length === 0) {
        return null;
      }

      return {
        sources,
        type: typeStr === 'auto' ? 'auto' : 'manual',
        updatedAt: Date.now()
      };
    } catch (error) {
      console.error(`[SongSourceConfigManager] 解析歌曲 ${id} 配置失败:`, error);
      return null;
    }
  }

  /**
   * 设置歌曲的自定义音源配置
   */
  static setConfig(
    songId: number | string,
    sources: Platform[],
    type: 'manual' | 'auto' = 'manual'
  ): void {
    const id = String(songId);

    if (!sources || sources.length === 0) {
      this.clearConfig(songId);
      return;
    }

    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, JSON.stringify(sources));
      localStorage.setItem(`${STORAGE_TYPE_KEY_PREFIX}${id}`, type);
    } catch (error) {
      console.error(`[SongSourceConfigManager] 保存歌曲 ${id} 配置失败:`, error);
    }
  }

  /**
   * 清除歌曲的自定义配置
   */
  static clearConfig(songId: number | string): void {
    const id = String(songId);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${id}`);
    localStorage.removeItem(`${STORAGE_TYPE_KEY_PREFIX}${id}`);
    // 同时清除内存中的已尝试音源
    this.clearTriedSources(songId);
  }

  /**
   * 检查歌曲是否有自定义配置
   */
  static hasConfig(songId: number | string): boolean {
    return this.getConfig(songId) !== null;
  }

  /**
   * 检查配置类型是否为手动设置
   */
  static isManualConfig(songId: number | string): boolean {
    const config = this.getConfig(songId);
    return config?.type === 'manual';
  }

  // ==================== 已尝试音源管理 ====================

  /**
   * 获取歌曲已尝试的音源列表
   */
  static getTriedSources(songId: number | string): Set<string> {
    const id = String(songId);
    if (!triedSourcesMap.has(id)) {
      triedSourcesMap.set(id, new Set());
    }
    return triedSourcesMap.get(id)!;
  }

  /**
   * 添加已尝试的音源
   */
  static addTriedSource(songId: number | string, source: string): void {
    const id = String(songId);
    const tried = this.getTriedSources(id);
    tried.add(source);
  }

  /**
   * 清除歌曲的已尝试音源
   */
  static clearTriedSources(songId: number | string): void {
    const id = String(songId);
    triedSourcesMap.delete(id);
    triedSourceDiffsMap.delete(id);
  }

  /**
   * 获取歌曲已尝试音源的时长差异
   */
  static getTriedSourceDiffs(songId: number | string): Map<string, number> {
    const id = String(songId);
    if (!triedSourceDiffsMap.has(id)) {
      triedSourceDiffsMap.set(id, new Map());
    }
    return triedSourceDiffsMap.get(id)!;
  }

  /**
   * 设置音源的时长差异
   */
  static setTriedSourceDiff(songId: number | string, source: string, diff: number): void {
    const id = String(songId);
    const diffs = this.getTriedSourceDiffs(id);
    diffs.set(source, diff);
  }

  /**
   * 查找最佳匹配的音源（时长差异最小）
   */
  static findBestMatchingSource(songId: number | string): { source: string; diff: number } | null {
    const diffs = this.getTriedSourceDiffs(songId);
    if (diffs.size === 0) {
      return null;
    }

    let bestSource = '';
    let minDiff = Infinity;

    for (const [source, diff] of diffs.entries()) {
      if (diff < minDiff) {
        minDiff = diff;
        bestSource = source;
      }
    }

    return bestSource ? { source: bestSource, diff: minDiff } : null;
  }

  /**
   * 清理所有内存缓存（用于测试或重置）
   */
  static clearAllMemoryCache(): void {
    triedSourcesMap.clear();
    triedSourceDiffsMap.clear();
  }
}

// 导出单例实例方便使用
export const songSourceConfig = SongSourceConfigManager;
