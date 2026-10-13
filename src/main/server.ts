import { ipcMain } from 'electron';
import Store from 'electron-store';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  type SearchPlatform,
  getPlatformCookie,
  getPlatformLoginStatus,
  loadPlatformCookies,
  multiPlatformSearch,
  setPlatformCookie
} from './multiPlatformSearch';
import { type Platform, unblockMusic } from './unblockMusic';

// 必须在 import netease-cloud-music-api-alger 之前创建 anonymous_token 文件
// 否则模块加载时 readFileSync 会因文件不存在而崩溃
if (!fs.existsSync(path.resolve(os.tmpdir(), 'anonymous_token'))) {
  fs.writeFileSync(path.resolve(os.tmpdir(), 'anonymous_token'), '', 'utf-8');
}

const store = new Store();

// 启动时加载已保存的平台 Cookie 到 process.env
loadPlatformCookies();

// 设置音乐解析的处理程序
ipcMain.handle('unblock-music', async (_event, id, songData, enabledSources) => {
  try {
    const result = await unblockMusic(id, songData, 1, enabledSources as Platform[]);
    return result;
  } catch (error) {
    console.error('音乐解析失败:', error);
    return { error: (error as Error).message || '未知错误' };
  }
});

// ==================== 多平台搜索 IPC ====================

// 多平台搜索
ipcMain.handle('multi-platform-search', async (_event, keyword: string, platforms: SearchPlatform[], limit?: number) => {
  try {
    return await multiPlatformSearch(keyword, platforms, limit || 20);
  } catch (error) {
    console.error('多平台搜索失败:', error);
    return [];
  }
});

// 获取平台 Cookie 配置
ipcMain.handle('get-platform-cookie', (_event, platform: SearchPlatform) => {
  return getPlatformCookie(platform);
});

// 设置平台 Cookie
ipcMain.handle('set-platform-cookie', (_event, platform: SearchPlatform, cookie: string) => {
  setPlatformCookie(platform, cookie);
  return true;
});

// 获取所有平台登录状态
ipcMain.handle('get-platform-login-status', () => {
  return getPlatformLoginStatus();
});

/**
 * 检查端口是否可用
 */
function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const tester = net
      .createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port);
  });
}

async function startMusicApi(): Promise<void> {

  const settings = store.get('set') as any;
  let port = settings?.musicApiPort || 30488;
  const maxRetries = 10;

  // 检查端口是否可用，如果不可用则尝试下一个端口
  for (let i = 0; i < maxRetries; i++) {
    const isAvailable = await checkPortAvailable(port);
    if (isAvailable) {
      break;
    }
    port++;
  }

  // 如果端口发生变化，保存新端口到配置
  const originalPort = settings?.musicApiPort || 30488;
  if (port !== originalPort) {
    store.set('set', { ...settings, musicApiPort: port });
  }

  try {
    const server = require('netease-cloud-music-api-alger/server');
    await server.serveNcmApi({
      port,
      // 安全默认值：仅监听本机回环地址，避免对局域网暴露
      host: '127.0.0.1'
    });
  } catch (error) {
    console.error(`MUSIC API 启动失败:`, error);
    throw error;
  }
}

export { startMusicApi };
