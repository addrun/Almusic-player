import { reactive } from 'vue';

import type { InstalledPlugin, PluginStoreItem } from '@/types/plugin';

export type InstallStatus = 'idle' | 'preparing' | 'requesting' | 'downloading' | 'installing' | 'done' | 'error';

export interface InstallProgress {
  status: InstallStatus;
  percent?: number;
}

class PluginManager {
  public registry = reactive<PluginStoreItem[]>([]);
  public installed = reactive<Record<string, InstalledPlugin>>({});
  public loading = reactive({ registry: false, installing: '' });
  public error = reactive({ registry: '' });
  public installProgress = reactive<Record<string, InstallProgress>>({});
  private removeProgressListener: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.api?.plugin?.onInstallProgress) {
      this.removeProgressListener = window.api.plugin.onInstallProgress((data) => {
        const existing = this.installProgress[data.pluginId];
        if (existing) {
          existing.status = data.status as InstallStatus;
          existing.percent = data.percent;
        } else {
          this.installProgress[data.pluginId] = {
            status: data.status as InstallStatus,
            percent: data.percent
          };
        }
      });
    }
  }

  getProgress(pluginId: string): InstallProgress {
    return this.installProgress[pluginId] || { status: 'idle' };
  }

  clearProgress(pluginId: string): void {
    delete this.installProgress[pluginId];
  }

  async loadRegistry(): Promise<void> {
    this.loading.registry = true;
    this.error.registry = '';
    try {
      this.registry.length = 0;
      const items = await window.api.plugin.getRegistry();
      items.forEach((item) => this.registry.push(item));
    } catch (e: any) {
      this.error.registry = e.message || '加载插件列表失败';
    } finally {
      this.loading.registry = false;
    }
  }

  async refreshRegistry(): Promise<void> {
    this.loading.registry = true;
    this.error.registry = '';
    try {
      this.registry.length = 0;
      const items = await window.api.plugin.refreshRegistry();
      items.forEach((item) => this.registry.push(item));
    } catch (e: any) {
      this.error.registry = e.message || '刷新插件列表失败';
    } finally {
      this.loading.registry = false;
    }
  }

  async loadInstalled(): Promise<void> {
    try {
      const items = await window.api.plugin.getInstalled();
      Object.assign(this.installed, items);
    } catch {}
  }

  async install(item: PluginStoreItem): Promise<void> {
    this.loading.installing = item.id;
    this.installProgress[item.id] = { status: 'preparing' };
    try {
      const raw = JSON.parse(JSON.stringify(item));
      const result = await window.api.plugin.install(raw);
      if (result) {
        (this.installed as any)[item.id] = result;
      }
      this.installProgress[item.id] = { status: 'done' };
    } catch (e: any) {
      this.installProgress[item.id] = { status: 'error' };
      throw e;
    } finally {
      this.loading.installing = '';
    }
  }

  async uninstall(pluginId: string): Promise<void> {
    try {
      await window.api.plugin.uninstall(pluginId);
    } catch (e: any) {
      console.error(`[PluginManager] IPC uninstall failed for ${pluginId}:`, e);
      throw e;
    }
    delete (this.installed as any)[pluginId];
  }

  async toggleEnabled(pluginId: string, enabled: boolean): Promise<void> {
    await window.api.plugin.toggleEnabled(pluginId, enabled);
    if ((this.installed as any)[pluginId]) {
      (this.installed as any)[pluginId].enabled = enabled;
    }
  }

  isInstalled(pluginId: string): boolean {
    return !!this.installed[pluginId];
  }

  isEnabled(pluginId: string): boolean {
    return this.installed[pluginId]?.enabled ?? false;
  }
}

export const pluginManager = new PluginManager();
