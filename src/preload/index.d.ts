import { ElectronAPI } from '@electron-toolkit/preload';

import type { InstalledPlugin, PluginStoreItem } from '../renderer/types/plugin';
import type { AppUpdateState } from '../shared/appUpdate';

interface API {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  quitApp: () => void;
  dragStart: (data: any) => void;
  miniTray: () => void;
  miniWindow: () => void;
  restore: () => void;
  toggleFullScreen: () => void;
  isFullScreen: () => Promise<boolean>;
  onFullScreenChanged: (callback: (isFullScreen: boolean) => void) => () => void;
  restart: () => void;
  resizeWindow: (width: number, height: number) => void;
  resizeMiniWindow: (showPlaylist: boolean) => void;
  openLyric: () => void;
  sendLyric: (data: any) => void;
  sendCoverColor: (color: string) => void;
  sendSong: (data: any) => void;
  unblockMusic: (id: number, data: any, enabledSources?: string[]) => Promise<any>;
  onLyricWindowClosed: (callback: () => void) => void;
  onLyricWindowReady: (callback: () => void) => void;
  getAppUpdateState: () => Promise<AppUpdateState>;
  checkAppUpdate: (manual?: boolean) => Promise<AppUpdateState>;
  downloadAppUpdate: () => Promise<AppUpdateState>;
  installAppUpdate: () => Promise<boolean>;
  openAppUpdatePage: () => Promise<boolean>;
  onAppUpdateState: (callback: (state: AppUpdateState) => void) => void;
  removeAppUpdateListeners: () => void;
  onLanguageChanged: (callback: (locale: string) => void) => void;
  importCustomApiPlugin: () => Promise<{ name: string; content: string } | null>;
  importLxMusicScript: () => Promise<{ name: string; content: string } | null>;
  openExternal: (url: string) => Promise<void>;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  getSearchSuggestions: (keyword: string) => Promise<any>;
  lxMusicHttpRequest: (request: { url: string; options: any; requestId: string }) => Promise<any>;
  lxMusicHttpCancel: (requestId: string) => Promise<void>;
  /** 扫描指定文件夹中的本地音乐文件 */
  scanLocalMusic: (folderPath: string) => Promise<{ files: string[]; count: number }>;
  /** 扫描指定文件夹中的本地音乐文件（包含修改时间） */
  scanLocalMusicWithStats: (
    folderPath: string
  ) => Promise<{ files: { path: string; modifiedTime: number }[]; count: number }>;
  /** 批量解析本地音乐文件元数据 */
  parseLocalMusicMetadata: (
    filePaths: string[]
  ) => Promise<import('../renderer/types/localMusic').LocalMusicMeta[]>;

  /** 插件商店 API */
  plugin: {
    getRegistry: () => Promise<PluginStoreItem[]>;
    getInstalled: () => Promise<Record<string, InstalledPlugin>>;
    install: (_item: PluginStoreItem) => Promise<InstalledPlugin>;
    uninstall: (_pluginId: string) => Promise<boolean>;
    toggleEnabled: (_pluginId: string, _enabled: boolean) => Promise<boolean>;
    importFile: (_type: string) => Promise<{ name: string; content: string; filePath: string } | null>;
    refreshRegistry: () => Promise<PluginStoreItem[]>;
    testMirrors: () => Promise<
      { name: string; url: string; ok: boolean; latencyMs: number; speed: number; error?: string }[]
    >;
    onInstallProgress: (
      _callback: (data: { pluginId: string; status: string; percent?: number }) => void
    ) => () => void;
  };

  /** 多平台搜索 */
  multiPlatformSearch: (
    keyword: string,
    platforms: string[],
    limit?: number
  ) => Promise<
    {
      platform: string;
      songs: {
        id: string;
        name: string;
        artists: string[];
        album: string;
        duration: number;
        picUrl?: string;
        platform: string;
        platformId: string;
      }[];
      error?: string;
    }[]
  >;
  getPlatformCookie: (platform: string) => Promise<{ cookie: string; expiresAt: number; updatedAt: number } | null>;
  setPlatformCookie: (platform: string, cookie: string) => Promise<boolean>;
  getPlatformLoginStatus: () => Promise<Record<string, boolean>>;
  openPlatformLogin: (platform: string) => Promise<boolean>;
  onPlatformLoginCookie: (callback: (platform: string, cookie: string) => void) => void;
}

// 自定义IPC渲染进程通信接口
interface IpcRenderer {
  send: (channel: string, ...args: any[]) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, listener: (...args: any[]) => void) => () => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: API;
    ipcRenderer: IpcRenderer;
    $message: any;
  }
}
