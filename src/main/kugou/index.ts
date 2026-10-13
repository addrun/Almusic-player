import { app, ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { KugouLyricsRequest, KugouSongUrlRequest } from '../../shared/kugou';
import { KugouApiError } from './protocol';
import { KugouService } from './service';

/** Only the installed application's main frame can use account-related read-only IPC. */
export function initializeKugou(
  mainWindow: BrowserWindow,
  rendererUrl = !app.isPackaged && process.env.ELECTRON_RENDERER_URL
    ? process.env.ELECTRON_RENDERER_URL
    : pathToFileURL(join(__dirname, '../renderer/index.html')).href
): void {
  const service = new KugouService(app.getPath('userData'));
  const channels: string[] = [];
  const register = (channel: string, handler: (...args: unknown[]) => unknown) => {
    ipcMain.removeHandler(channel);
    channels.push(channel);
    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (
        mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id ||
        event.senderFrame !== mainWindow.webContents.mainFrame
      ) throw new Error('该窗口不能访问酷狗账号。');
      const sender = event.senderFrame?.url || '';
      if (!sender || sender.split('#')[0] !== rendererUrl.split('#')[0]) throw new Error('酷狗请求来源无效。');
      try { return await handler(...args); }
      catch (error) {
        // IPC errors intentionally contain no raw transport objects, request URLs or credentials.
        throw new Error(error instanceof KugouApiError ? error.message : '酷狗请求未完成，请重试。');
      }
    });
  };
  const noArguments = (args: unknown[]) => {
    if (args.length) throw new KugouApiError('酷狗请求参数无效。');
  };
  const sessionId = (value: unknown) => {
    if (typeof value !== 'string' || !/^[a-f0-9]{32}$/.test(value)) throw new KugouApiError('登录会话无效，请重新获取二维码。');
    return value;
  };
  const record = (value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new KugouApiError('酷狗请求参数无效。');
    return value as Record<string, unknown>;
  };

  register('kugou:status', (...args) => { noArguments(args); return service.status(); });
  register('kugou:login-create', (...args) => { noArguments(args); return service.createLogin(); });
  register('kugou:login-check', (...args) => {
    if (args.length !== 1) throw new KugouApiError('酷狗请求参数无效。');
    return service.checkLogin(sessionId(args[0]));
  });
  register('kugou:login-cancel', (...args) => {
    if (args.length !== 1) throw new KugouApiError('酷狗请求参数无效。');
    return service.cancelLogin(sessionId(args[0]));
  });
  register('kugou:logout', (...args) => { noArguments(args); return service.logout(); });
  register('kugou:library', (...args) => { noArguments(args); return service.library(); });
  register('kugou:sync', (...args) => {
    noArguments(args);
    return service.sync((progress) => {
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('kugou:sync-progress', progress);
    });
  });
  register('kugou:playlist-tracks', (...args) => {
    if (args.length < 1 || args.length > 2 || typeof args[0] !== 'string' || !/^[01]:[a-zA-Z0-9_-]{1,120}$/.test(args[0])) {
      throw new KugouApiError('酷狗歌单编号无效。');
    }
    if (args[1] !== undefined && typeof args[1] !== 'boolean') throw new KugouApiError('刷新参数无效。');
    return service.playlistTracks(args[0], args[1] as boolean | undefined);
  });
  register('kugou:song-url', (...args) => {
    if (args.length !== 1) throw new KugouApiError('酷狗请求参数无效。');
    const request = record(args[0]);
    if (Object.keys(request).some((key) => !['hash', 'albumId', 'albumAudioId', 'quality'].includes(key))) throw new KugouApiError('酷狗音频请求参数无效。');
    return service.songUrl(request as unknown as KugouSongUrlRequest);
  });
  register('kugou:lyrics', (...args) => {
    if (args.length !== 1) throw new KugouApiError('酷狗请求参数无效。');
    const request = record(args[0]);
    if (Object.keys(request).some((key) => !['hash', 'name', 'durationMs'].includes(key))) throw new KugouApiError('酷狗歌词请求参数无效。');
    return service.lyrics(request as unknown as KugouLyricsRequest);
  });

  app.once('before-quit', () => {
    service.dispose();
    for (const channel of channels) ipcMain.removeHandler(channel);
  });
}
