import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { safeStorage } from 'electron';

import type { KugouLibrary, KugouPlaylistTracks, KugouProfile } from '../../shared/kugou';
import { asObject, KugouApiError } from './protocol';
import type { KugouCredentials } from './protocol';

export interface KugouAccount {
  credentials: KugouCredentials;
  profile: KugouProfile;
}

export interface KugouCache {
  version: 1;
  userId: string;
  library: KugouLibrary;
  tracks: Record<string, KugouPlaylistTracks>;
}

export class KugouStorage {
  private readonly accountPath: string;
  private readonly cachePath: string;

  constructor(directory: string) {
    this.accountPath = join(directory, 'kugou-account.safe');
    this.cachePath = join(directory, 'kugou-library.safe');
  }

  available(): boolean {
    // Linux basic_text is not OS-protected encryption; do not silently fall back to it.
    return safeStorage.isEncryptionAvailable() &&
      (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text');
  }

  loadAccount(): KugouAccount | undefined {
    const account = this.load(this.accountPath, 1024 * 1024);
    if (!account) return undefined;
    const credentials = asObject(account.credentials);
    const profile = asObject(account.profile);
    const device = asObject(credentials.device);
    if (
      typeof credentials.userId !== 'string' || !/^\d{1,20}$/.test(credentials.userId) ||
      typeof credentials.token !== 'string' || !credentials.token || credentials.token.length > 4096 ||
      typeof device.mid !== 'string' || !/^\d{1,45}$/.test(device.mid) ||
      typeof device.dev !== 'string' || !/^[A-Z0-9]{10}$/.test(device.dev) ||
      typeof device.dfid !== 'string' || device.dfid.length > 100 ||
      profile.userId !== credentials.userId || typeof profile.nickname !== 'string'
    ) return undefined;
    return account as unknown as KugouAccount;
  }

  loadCache(userId: string): KugouCache | undefined {
    const cache = this.load(this.cachePath, 64 * 1024 * 1024);
    if (!cache || cache.version !== 1 || cache.userId !== userId) return undefined;
    const library = asObject(cache.library);
    if (asObject(library.profile).userId !== userId || !Array.isArray(library.playlists)) return undefined;
    if (!cache.tracks || typeof cache.tracks !== 'object' || Array.isArray(cache.tracks)) return undefined;
    return cache as unknown as KugouCache;
  }

  saveAccount(account: KugouAccount): boolean {
    return this.save(this.accountPath, account);
  }

  saveCache(cache: KugouCache): boolean {
    return this.save(this.cachePath, cache);
  }

  clear(): void {
    for (const path of [this.accountPath, this.cachePath]) {
      if (existsSync(path)) unlinkSync(path);
    }
  }

  private load(path: string, limit: number): Record<string, unknown> | undefined {
    if (!this.available() || !existsSync(path)) return undefined;
    try {
      const buffer = readFileSync(path);
      if (buffer.length > limit) return undefined;
      const value: unknown = JSON.parse(safeStorage.decryptString(buffer));
      return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
    } catch {
      // No token, file contents or native decryption errors are logged.
      return undefined;
    }
  }

  private save(path: string, value: unknown): boolean {
    if (!this.available()) return false;
    const temporary = `${path}.${randomBytes(6).toString('hex')}.tmp`;
    try {
      const encrypted = safeStorage.encryptString(JSON.stringify(value));
      writeFileSync(temporary, encrypted, { mode: 0o600, flag: 'wx' });
      renameSync(temporary, path);
      return true;
    } catch {
      try { if (existsSync(temporary)) unlinkSync(temporary); } catch { /* best effort */ }
      throw new KugouApiError('保存本机酷狗数据失败；当前结果仍可在本次运行中使用。');
    }
  }
}
