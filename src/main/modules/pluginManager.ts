import { dialog, ipcMain, net } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import { getStore } from './config';

const GITHUB_RAW = 'https://raw.githubusercontent.com';
const REGISTRY_PATH = '/cang-dot/zephyrus-player-plugins/main/index.json';
const CACHE_TTL_MS = 3600_000;

interface PluginStoreItem {
  id: string
  name: string
  description: string
  version: string
  type: string
  author: { name: string; url?: string }
  icon?: string
  screenshots?: string[]
  downloadUrl: string
  sourceRepo: string
  homepage?: string
  license?: string
  minAppVersion?: string
  tags?: string[]
  downloads?: number
  submittedAt?: string
  approvedAt?: string
}

interface InstalledPlugin {
  manifest: PluginStoreItem
  enabled: boolean
  installedAt: number
  payload?: Record<string, string>
}

interface MirrorTestResult {
  name: string
  url: string
  ok: boolean
  latencyMs: number
  speed: number
  error?: string
}

function getMirrorUrl(): string {
  const store = getStore();
  const mirror = (store.get('set.githubMirror') as string) || '';
  return mirror.trim();
}

function buildUrl(originalUrl: string): string {
  const mirror = getMirrorUrl();
  if (!mirror) return originalUrl;
  return `${mirror}/${originalUrl}`;
}

function getRegistryUrl(): string {
  return buildUrl(`${GITHUB_RAW}${REGISTRY_PATH}`);
}

function getDownloadUrl(originalUrl: string): string {
  const mirror = getMirrorUrl();
  const base = mirror ? `${mirror}/${originalUrl}` : originalUrl;
  return `${base}?t=${Date.now()}`;
}

async function downloadWithProgress(
  url: string,
  pluginId: string,
  sender: Electron.WebContents
): Promise<string> {
  sender.send('plugin:install-progress', { pluginId, status: 'requesting' });

  const response = await net.fetch(url);
  if (!response.ok) throw new Error(`下载失败: HTTP ${response.status}`);

  sender.send('plugin:install-progress', { pluginId, status: 'downloading', percent: 50 });

  const text = await response.text();

  sender.send('plugin:install-progress', { pluginId, status: 'installing' });
  return text;
}

export function initializePluginManager(): void {
  ipcMain.handle('plugin:get-registry', async () => {
    const store = getStore();
    const cached = store.get('plugins.registryCache') as
      | { data: PluginStoreItem[]; cachedAt: number }
      | undefined;

    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS && cached.data.length > 0) {
      return cached.data;
    }

    try {
      const url = getRegistryUrl();
      const response = await net.fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const plugins: PluginStoreItem[] = json.plugins || [];
      store.set('plugins.registryCache', { data: plugins, cachedAt: Date.now() });
      return plugins;
    } catch (e: any) {
      console.error('[PluginManager] get-registry failed:', e?.message);
      return cached?.data || [];
    }
  });

  ipcMain.handle('plugin:get-installed', async () => {
    const store = getStore();
    const installed = store.get('plugins.installed') as Record<string, InstalledPlugin> | undefined;
    return installed || {};
  });

  ipcMain.handle('plugin:install', async (event, item: PluginStoreItem) => {
    const store = getStore();
    const installed =
      (store.get('plugins.installed') as Record<string, InstalledPlugin> | undefined) || {};
    const sender = event.sender;

    if (installed[item.id]) {
      throw new Error('插件已安装');
    }

    sender.send('plugin:install-progress', { pluginId: item.id, status: 'preparing' });

    let payload: Record<string, string> | undefined;

    if (item.type === 'lxMusic' || item.type === 'translator') {
      const url = getDownloadUrl(item.downloadUrl);
      const content = await downloadWithProgress(url, item.id, sender);
      payload = { script: content };

      if (item.type === 'lxMusic') {
        const scripts = (store.get('set.lxMusicScripts') as any[]) || [];
        const newScript = {
          id: `plugin_${item.id}_${Date.now()}`,
          name: item.name,
          script: content,
          info: { name: item.name, rawScript: content },
          sources: [],
          enabled: true,
          createdAt: Date.now()
        };
        scripts.push(newScript);
        store.set('set.lxMusicScripts', scripts);
        store.set('set.activeLxMusicApiId', newScript.id);
      }
    }

    if (item.type === 'customApi') {
      const url = getDownloadUrl(item.downloadUrl);
      const content = await downloadWithProgress(url, item.id, sender);
      payload = { config: content };
      store.set('set.customApiPlugin', content);
      store.set('set.customApiPluginName', item.name);
    }

    installed[item.id] = {
      manifest: item,
      enabled: true,
      installedAt: Date.now(),
      payload
    };

    store.set('plugins.installed', installed);
    sender.send('plugin:install-progress', { pluginId: item.id, status: 'done' });
    return installed[item.id];
  });

  ipcMain.handle('plugin:uninstall', async (_, pluginId: string) => {
    const store = getStore();
    const installed =
      (store.get('plugins.installed') as Record<string, InstalledPlugin> | undefined) || {};
    const plugin = installed[pluginId];
    if (!plugin) throw new Error('插件未安装');

    if (plugin.manifest.type === 'lxMusic') {
      const scripts = (store.get('set.lxMusicScripts') as any[]) || [];
      const remaining = scripts.filter(
        (s: any) => !s.name.includes(plugin.manifest.name) && !s.id.includes(pluginId)
      );
      store.set('set.lxMusicScripts', remaining);
      if (remaining.length === 0) {
        store.set('set.activeLxMusicApiId', null);
      } else {
        store.set('set.activeLxMusicApiId', remaining[0].id);
      }
    }

    if (plugin.manifest.type === 'customApi') {
      store.set('set.customApiPlugin', '');
      store.set('set.customApiPluginName', '');
    }

    delete installed[pluginId];
    store.set('plugins.installed', installed);

    return true;
  });

  ipcMain.handle('plugin:toggle-enabled', async (_, pluginId: string, enabled: boolean) => {
    const store = getStore();
    const installed =
      (store.get('plugins.installed') as Record<string, InstalledPlugin> | undefined) || {};
    if (!installed[pluginId]) throw new Error('插件未安装');
    installed[pluginId].enabled = enabled;
    store.set('plugins.installed', installed);
    return true;
  });

  ipcMain.handle('plugin:import-file', async (_, type: string) => {
    const filters: Electron.FileFilter[] =
      type === 'lxMusic'
        ? [{ name: 'JavaScript Files', extensions: ['js'] }]
        : type === 'customApi'
          ? [{ name: 'JSON Files', extensions: ['json'] }]
          : [{ name: 'All Files', extensions: ['*'] }];

    const result = await dialog.showOpenDialog({
      title: '导入插件文件',
      filters,
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return {
        name: path.basename(filePath, path.extname(filePath)),
        content,
        filePath
      };
    } catch {
      return null;
    }
  });

  ipcMain.handle('plugin:refresh-registry', async () => {
    const store = getStore();
    try {
      const url = getRegistryUrl();
      const response = await net.fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const plugins: PluginStoreItem[] = json.plugins || [];
      store.set('plugins.registryCache', { data: plugins, cachedAt: Date.now() });
      return plugins;
    } catch {
      const cached = store.get('plugins.registryCache') as
        | { data: PluginStoreItem[]; cachedAt: number }
        | undefined;
      return cached?.data || [];
    }
  });

  ipcMain.handle('plugin:test-mirrors', async () => {
    const testUrl = `${GITHUB_RAW}/cang-dot/zephyrus-player-plugins/main/index.json`;
    const mirrors = [
      { name: 'GitHub 直连', url: '' },
      { name: 'gh-proxy.com', url: 'https://gh-proxy.com' },
      { name: 'ghproxy.net', url: 'https://ghproxy.net' },
      { name: 'ghproxy.link', url: 'https://ghproxy.link' },
      { name: 'ghfast.top', url: 'https://ghfast.top' },
      { name: 'ghproxy.cxkpro.top', url: 'https://ghproxy.cxkpro.top' },
      { name: 'github-proxy.memory-echoes.cn', url: 'https://github-proxy.memory-echoes.cn' }
    ];

    const results: MirrorTestResult[] = [];

    for (const mirror of mirrors) {
      const targetUrl = mirror.url ? `${mirror.url}/${testUrl}` : testUrl;
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const response = await net.fetch(targetUrl, { signal: controller.signal });
        clearTimeout(timer);
        const latencyMs = Date.now() - start;

        if (!response.ok) {
          results.push({
            name: mirror.name,
            url: mirror.url,
            ok: false,
            latencyMs,
            speed: 0,
            error: `HTTP ${response.status}`
          });
          continue;
        }

        const text = await response.text();
        const downloadMs = Math.max(1, Date.now() - start);
        const speed = Math.round((text.length / downloadMs) * 1000);

        results.push({
          name: mirror.name,
          url: mirror.url,
          ok: true,
          latencyMs,
          speed
        });
      } catch (e: any) {
        results.push({
          name: mirror.name,
          url: mirror.url,
          ok: false,
          latencyMs: Date.now() - start,
          speed: 0,
          error: e?.name === 'AbortError' ? '超时' : (e?.message || '连接失败')
        });
      }
    }

    return results;
  });
}
