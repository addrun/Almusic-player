/**
 * 本地歌词文件存储管理
 *
 * 用于存储每首歌曲对应的本地歌词文件路径
 * 支持 TTML 和 LRC 格式
 */

const STORAGE_KEY = 'zephyrus-local-lyrics';

export interface LocalLyricMapping {
  [songId: string]: string; // 歌曲ID → 歌词文件路径
}

/**
 * 获取所有本地歌词映射
 */
export function getLocalLyricMap(): LocalLyricMapping {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('读取本地歌词映射失败:', e);
  }
  return {};
}

/**
 * 设置歌曲的本地歌词文件路径
 */
export function setLocalLyricPath(songId: string, filePath: string): void {
  const map = getLocalLyricMap();
  map[songId] = filePath;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * 批量设置歌曲的本地歌词文件路径
 */
export function batchSetLocalLyricPaths(
  mappings: Array<{ songId: string; lyricPath: string }>
): void {
  const map = getLocalLyricMap();
  for (const { songId, lyricPath } of mappings) {
    map[songId] = lyricPath;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * 获取歌曲的本地歌词文件路径
 */
export function getLocalLyricPath(songId: string): string | null {
  const map = getLocalLyricMap();
  return map[songId] || null;
}

/**
 * 删除歌曲的本地歌词映射
 */
export function removeLocalLyricPath(songId: string): void {
  const map = getLocalLyricMap();
  delete map[songId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * 读取本地歌词文件内容
 * 在 Electron 环境下通过 IPC 读取文件
 */
export async function readLocalLyricFile(filePath: string): Promise<string | null> {
  if (isElectron) {
    try {
      const content = await window.electron.ipcRenderer.invoke('read-file', filePath);
      return content;
    } catch (error) {
      console.error('读取本地歌词文件失败:', error);
      return null;
    }
  }
  console.warn('本地歌词文件读取仅支持 Electron 环境');
  return null;
}

/**
 * 打开文件选择对话框选择歌词文件
 */
export async function selectLyricFile(): Promise<string | null> {
  if (isElectron) {
    try {
      const result = await window.electron.ipcRenderer.invoke('select-file', {
        filters: [
          { name: '歌词文件', extensions: ['lrc', 'ttml', 'txt'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });
      return result || null;
    } catch (error) {
      console.error('选择歌词文件失败:', error);
      return null;
    }
  }
  console.warn('文件选择仅支持 Electron 环境');
  return null;
}

import { isElectron } from '@/utils';
