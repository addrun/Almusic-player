import { BrowserWindow, ipcMain, session } from 'electron';
import { join } from 'path';

import i18n from '../../i18n/main';
import { setPlatformCookie, type SearchPlatform } from '../multiPlatformSearch';

// ==================== 网易云登录窗口（原有逻辑） ====================

let loginWindow: BrowserWindow | null = null;

const loginUrl = 'https://music.163.com/#/login/';
const loginTitle = i18n.global.t('login.qrTitle');

/**
 * 打开登录窗口获取Cookie
 */
const openLoginWindow = async (mainWin: BrowserWindow) => {
  let loginTimer: NodeJS.Timeout;

  // 如果登录窗口已存在，则聚焦并返回
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return;
  }

  const loginSession = session.fromPartition('persist:login');

  // 清除 Cookie
  await loginSession.clearStorageData({
    storages: ['cookies', 'localstorage']
  });

  loginWindow = new BrowserWindow({
    parent: mainWin,
    title: loginTitle,
    width: 1280,
    height: 800,
    center: true,
    autoHideMenuBar: true,
    webPreferences: {
      session: loginSession,
      contextIsolation: true,
      sandbox: false,
      preload: join(__dirname, '../../preload/index.js')
    }
  });

  // 打开登录页面
  loginWindow.loadURL(loginUrl);

  // 阻止新窗口创建
  loginWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // 检查是否登录
  const checkLogin = async () => {
    try {
      if (!loginWindow || loginWindow.isDestroyed()) {
        if (loginTimer) clearInterval(loginTimer);
        return;
      }

      const MUSIC_U = await loginSession.cookies.get({
        name: 'MUSIC_U'
      });

      if (MUSIC_U && MUSIC_U?.length > 0) {
        if (loginTimer) clearInterval(loginTimer);
        const value = `MUSIC_U=${MUSIC_U[0].value};`;

        mainWin?.webContents.send('send-cookies', value);

        // 关闭登录窗口
        loginWindow.destroy();
        loginWindow = null;
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
    }
  };

  // 循环检查登录状态
  loginWindow.webContents.once('did-finish-load', () => {
    loginWindow?.show();
    loginTimer = setInterval(checkLogin, 500);

    loginWindow?.on('closed', () => {
      if (loginTimer) clearInterval(loginTimer);
      loginWindow = null;
    });
  });
};

// ==================== 多平台登录窗口 ====================

/**
 * 各平台的登录配置
 */
interface PlatformLoginConfig {
  url: string;
  /** 用于检测登录成功的关键 Cookie 名称（任一存在即视为登录成功） */
  cookieKeys: string[];
  /** 窗口标题 */
  title: string;
}

const PLATFORM_LOGIN_CONFIGS: Record<string, PlatformLoginConfig> = {
  qq: {
    url: 'https://y.qq.com/',
    cookieKeys: ['uin', 'qm_keyst'],
    title: 'QQ 音乐登录'
  },
  migu: {
    url: 'https://music.migu.cn/v3/',
    cookieKeys: ['aversionid', 'migu_music_sid'],
    title: '咪咕音乐登录'
  },
  joox: {
    url: 'http://www.joox.com/',
    cookieKeys: ['wmid', 'session_key'],
    title: 'JOOX 登录'
  }
};

let platformLoginWindow: BrowserWindow | null = null;

/**
 * 打开平台登录窗口获取 Cookie
 * 用户在登录窗口中完成登录后，自动提取 Cookie 并保存。
 */
async function openPlatformLoginWindow(
  mainWin: BrowserWindow,
  platform: SearchPlatform
): Promise<boolean> {
  // 不支持的提示
  const config = PLATFORM_LOGIN_CONFIGS[platform];
  if (!config) {
    // 不需要登录的平台（酷狗/酷我）或未知平台
    return false;
  }

  // 如果登录窗口已存在，则聚焦并返回
  if (platformLoginWindow && !platformLoginWindow.isDestroyed()) {
    platformLoginWindow.focus();
    return false;
  }

  const loginSession = session.fromPartition(`persist:platform-${platform}`);

  // 清除该平台分区的历史 Cookie
  await loginSession.clearStorageData({
    storages: ['cookies', 'localstorage']
  });

  platformLoginWindow = new BrowserWindow({
    parent: mainWin,
    title: config.title,
    width: 1024,
    height: 768,
    center: true,
    autoHideMenuBar: true,
    webPreferences: {
      session: loginSession,
      contextIsolation: true,
      sandbox: false
    }
  });

  platformLoginWindow.loadURL(config.url);

  // 允许在同一窗口内导航（登录流程需要）
  platformLoginWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  let checkTimer: NodeJS.Timeout | null = null;

  // 检测登录状态：提取关键 Cookie
  const checkPlatformLogin = async () => {
    try {
      if (!platformLoginWindow || platformLoginWindow.isDestroyed()) {
        if (checkTimer) clearInterval(checkTimer);
        return;
      }

      // 获取该 session 的所有 cookie
      const allCookies = await loginSession.cookies.get({});
      const cookieMap = new Map(allCookies.map((c) => [c.name, c.value]));

      // 检查是否所有关键 Cookie 都存在
      const foundKeys = config.cookieKeys.filter((key) => {
        const val = cookieMap.get(key);
        return val && val.length > 0;
      });

      // QQ 音乐只需要 uin 和 qm_keyst 都存在
      // JOOX 需要 wmid 和 session_key 都存在
      // 咪咕 aversionid 或 migu_music_sid 之一存在即可
      let loggedIn: boolean;
      if (platform === 'migu') {
        loggedIn = foundKeys.length > 0;
      } else {
        loggedIn = foundKeys.length === config.cookieKeys.length;
      }

      if (loggedIn) {
        if (checkTimer) {
          clearInterval(checkTimer);
          checkTimer = null;
        }

        // 构建 cookie 字符串
        const cookieStr = allCookies
          .filter((c) => {
            // 只保留关键 cookie 及相关的
            return config.cookieKeys.includes(c.name);
          })
          .map((c) => `${c.name}=${c.value}`)
          .join('; ');

        // 保存 Cookie
        setPlatformCookie(platform, cookieStr);

        // 通知渲染进程
        mainWin?.webContents.send('platform-login-cookie', platform, cookieStr);

        // 关闭窗口
        if (platformLoginWindow && !platformLoginWindow.isDestroyed()) {
          platformLoginWindow.destroy();
        }
        platformLoginWindow = null;
      }
    } catch (error) {
      console.error(`检查 ${platform} 登录状态失败:`, error);
    }
  };

  // 显示窗口并开始检测
  platformLoginWindow.webContents.once('did-finish-load', () => {
    platformLoginWindow?.show();
    checkTimer = setInterval(checkPlatformLogin, 1000);

    platformLoginWindow?.on('closed', () => {
      if (checkTimer) clearInterval(checkTimer);
      platformLoginWindow = null;
    });
  });

  return true;
}

// ==================== IPC 注册 ====================

/**
 * 初始化登录窗口相关的IPC监听
 */
export function initializeLoginWindow() {
  // 网易云登录
  ipcMain.on('open-login', (event) => {
    const mainWin = BrowserWindow.fromWebContents(event.sender);
    if (mainWin) {
      openLoginWindow(mainWin);
    }
  });

  // 多平台登录
  ipcMain.handle('open-platform-login', (event, platform: SearchPlatform) => {
    const mainWin = BrowserWindow.fromWebContents(event.sender);
    if (mainWin) {
      return openPlatformLoginWindow(mainWin, platform);
    }
    return false;
  });
}

export default openLoginWindow;
