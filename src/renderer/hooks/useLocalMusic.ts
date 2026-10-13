/**
 * 本地歌曲专属解析逻辑模块
 *
 * 所有本地歌曲（URL 以 local:// 开头）的播放、歌词、进度条逻辑
 * 与在线歌曲完全分离，不走网易云 API
 */
import { createDiscreteApi } from 'naive-ui';

import { getLocalLyricPath, readLocalLyricFile } from '@/utils/localLyricStorage';
import { isElectron } from '@/utils';
import { parseLyricContent } from '@/utils/localMusicUtils';

import type { SongResult } from '@/types/music';
import type { ILyric } from '@/types';

let _message: ReturnType<typeof createDiscreteApi>['message'] | null = null;
const getMessage = () => {
  if (!_message) _message = createDiscreteApi(['message']).message;
  return _message;
};

/**
* 判断是否为本地歌曲
*/
export function isLocalSong(song: SongResult | null | undefined): boolean {
if (!song) return false;
// 跨平台歌曲（非网易云）不是本地歌曲
if (song.platform && song.platform !== 'netease') return false;
return song.playMusicUrl?.startsWith('local://') || typeof song.id === 'string';
}

/**
 * 本地歌曲专属逻辑
 */
export function useLocalMusic() {
  const message = getMessage();

  /**
   * 验证本地文件是否存在
   */
  const checkFileExists = async (song: SongResult): Promise<boolean> => {
    if (!isElectron) return true;
    const url = song.playMusicUrl;
    if (!url) return false;
    try {
      const encodedPath = url.replace('local:///', '');
      const filePath = decodeURIComponent(encodedPath);
      return await window.electron.api.invoke('check-file-exists', filePath);
    } catch {
      return false;
    }
  };

  /**
   * 本地播放前验证
   * @returns true 可以播放，false 文件不存在
   */
  const playLocalSong = async (song: SongResult): Promise<boolean> => {
    const exists = await checkFileExists(song);
    if (!exists) {
      message.error(`文件不存在: ${song.name}，请检查文件是否已被移动或删除`);
      return false;
    }
    return true;
  };

  /**
   * 本地歌词加载（不走网易云 API）
   * 优先级：外部 .lrc 文件 → 内嵌歌词 → 社区歌词 → 空
   */
  const loadLocalLyrics = async (song: SongResult): Promise<ILyric> => {
    const songId = song.id?.toString();

    // 优先级 1：已绑定的外部 .lrc 文件
    if (isElectron && songId) {
      const boundPath = getLocalLyricPath(songId);
      if (boundPath) {
        try {
          const content = await readLocalLyricFile(boundPath);
          if (content) {
            const result = parseLyricContent(content, boundPath);
            if (result && result.lrcTimeArray.length > 0) {
              return result;
            }
          }
        } catch (error) {
          console.warn('读取外部歌词文件失败:', error);
        }
      }
    }

    // 优先级 2：内嵌歌词（已存在于 song.lyric）
    if (song.lyric) {
      if (song.lyric.lrcTimeArray.length > 0) {
        return song.lyric;
      }
      // 内嵌歌词无时间戳但有文本：也返回，供静态展示
      if (song.lyric.lrcArray.length > 0) {
        return song.lyric;
      }
    }

    // 优先级 3：社区歌词
    try {
      const { loadCommunityLyricForSong } = await import('@/api/communityLyric');
      const communityLyric = await loadCommunityLyricForSong(songId || '');
      if (communityLyric?.lrcContent) {
        const result = parseLyricContent(communityLyric.lrcContent);
        if (result && result.lrcTimeArray.length > 0) {
          return result;
        }
      }
    } catch {
      // 社区歌词加载失败，静默处理
    }

    // 优先级 4：空歌词
    return { lrcTimeArray: [], lrcArray: [], hasWordByWord: false };
  };

  /**
   * 本地歌曲错误处理（不自动跳下一首）
   */
  const handleLocalError = (song: SongResult) => {
    message.error(`本地文件无法播放: ${song.name}`);
  };

  /**
   * 获取本地歌曲绑定的歌词文件名
   */
  const getBoundLyricFileName = (songId: string): string | null => {
    if (!isElectron) return null;
    const boundPath = getLocalLyricPath(songId);
    if (!boundPath) return null;
    // 返回文件名（不含路径）
    const parts = boundPath.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || null;
  };

  return {
    checkFileExists,
    playLocalSong,
    loadLocalLyrics,
    handleLocalError,
    getBoundLyricFileName
  };
}
