import { EventEmitter } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import type { ThumbarButton } from 'electron';

export const ipcMain = new EventEmitter();
export const app = { getAppPath: () => resolve('.') };
export const nativeTheme = Object.assign(new EventEmitter(), { shouldUseDarkColors: false });
export const TASKBAR_BUTTON_CREATED_MESSAGE = 0xc001;
export const nativeImage = {
  forceEmpty: false,
  loadedPaths: [] as string[],
  createFromPath(path: string) {
    this.loadedPaths.push(path);
    const empty =
      this.forceEmpty ||
      !existsSync(path) ||
      readFileSync(path).subarray(0, 8).toString('hex') !== '89504e470d0a1a0a';
    return { name: basename(path), isEmpty: () => empty };
  }
};

export class TaskbarWindowFixture extends EventEmitter {
  destroyed = false;
  visible = true;
  minimized = false;
  attempts = 0;
  messageHooks = new Map<number, (...args: Buffer[]) => void>();
  nativeResults: Array<boolean | Error> = [];
  buttons: ThumbarButton[] = [];
  tooltips: string[] = [];
  webContents = Object.assign(new EventEmitter(), {
    mainFrame: { url: 'file:///isolated-taskbar-fixture.html' },
    destroyed: false,
    loading: false,
    sends: [] as Array<{ channel: string; args: unknown[] }>,
    send: (channel: string, ...args: unknown[]) => {
      this.webContents.sends.push({ channel, args });
      this.webContents.emit('fixture-send', channel, ...args);
    },
    isDestroyed: () => this.webContents.destroyed,
    isLoadingMainFrame: () => this.webContents.loading
  });

  isDestroyed() {
    return this.destroyed;
  }
  isVisible() {
    return this.visible;
  }
  isMinimized() {
    return this.minimized;
  }
  isWindowMessageHooked(message: number) {
    return this.messageHooks.has(message);
  }
  hookWindowMessage(message: number, callback: (...args: Buffer[]) => void) {
    this.messageHooks.set(message, callback);
  }
  unhookWindowMessage(message: number) {
    this.messageHooks.delete(message);
  }
  postMessage(message: number) {
    this.messageHooks.get(message)?.(Buffer.alloc(8), Buffer.alloc(8));
  }
  setThumbarButtons(buttons: ThumbarButton[]) {
    if (this.destroyed) throw new Error('Window is closed');
    this.attempts++;
    this.buttons = buttons;
    const result = this.nativeResults.shift() ?? true;
    if (result instanceof Error) throw result;
    return result;
  }
  setThumbnailToolTip(text: string) {
    if (this.destroyed) throw new Error('Window is closed');
    this.tooltips.push(text);
  }
  event() {
    return { sender: this.webContents, senderFrame: this.webContents.mainFrame };
  }
  close() {
    this.destroyed = true;
    this.webContents.destroyed = true;
    this.emit('closed');
    this.messageHooks.clear();
  }
}
