// Isolated test fixture for projection and storage checks. This does not prove
// an actual login, Windows DPAPI operation, or a live account synchronisation.
import { EventEmitter } from 'node:events';

export const ipcMain = Object.assign(new EventEmitter(), {
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  handle(channel: string, callback: (...args: unknown[]) => unknown) {
    this.handlers.set(channel, callback);
  },
  removeHandler(channel: string) {
    this.handlers.delete(channel);
  }
});

export const safeStorage = {
  enabled: true,
  isEncryptionAvailable() { return this.enabled; },
  getSelectedStorageBackend() { return 'test'; },
  encryptString(value: string) { return Buffer.from(`fixture:${value}`, 'utf8'); },
  decryptString(value: Buffer) {
    const text = value.toString('utf8');
    if (!text.startsWith('fixture:')) throw new Error('invalid fixture');
    return text.slice('fixture:'.length);
  }
};

export const app = Object.assign(new EventEmitter(), {
  testDirectory: '',
  getPath() {
    if (!this.testDirectory) throw new Error('Tests must use their own temporary directory');
    return this.testDirectory;
  }
});
export class BrowserWindow {}
