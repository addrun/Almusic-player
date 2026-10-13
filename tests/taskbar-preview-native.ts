/** Real same-process DWM/GDI calls in the isolated test Electron. No player account or network. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join, resolve } from 'node:path';

import { app, BrowserWindow, nativeImage, session } from 'electron';

import {
  DWM_LIVE_PREVIEW_MESSAGE,
  DWM_THUMBNAIL_MESSAGE,
  fitPreviewSize,
  initializeTaskbarPreview,
  normalizePreviewState,
  renderTaskbarPreviewBitmap
} from '../src/main/modules/taskbarPreview';

const fixtureDirectory = process.env.ZEPHYRUS_PREVIEW_TEST_DIR;
if (!fixtureDirectory || process.platform !== 'win32') app.exit(2);
const directory = resolve(fixtureDirectory!);
mkdirSync(join(directory, 'profile'), { recursive: true });
mkdirSync(join(directory, 'session'), { recursive: true });
app.setName('ZephyrusNativePreviewFixture');
app.setPath('userData', join(directory, 'profile'));
app.setPath('sessionData', join(directory, 'session'));
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');

type Call = {
  name: string;
  result: number | boolean | null;
  enabled?: boolean;
  attribute?: number;
  text?: string;
  flags?: number;
};
const evidence = {
  fixture: 'isolated-same-process-dwm-gdi-preview',
  electron: process.versions.electron,
  arch: process.arch,
  externalRequestsBlocked: 0,
  nativeCalls: [] as Call[],
  syntheticRequests: 0,
  bitmapCreates: 0,
  bitmapDeletes: 0,
  thumbnailDisplayVerified: false,
  gdiBefore: 0,
  gdiAfter: 0,
  cards: [] as Array<{
    name: string;
    width: number;
    height: number;
    alphaOpaque: boolean;
    pngBytes: number;
  }>,
  checks: {} as Record<string, boolean>,
  errors: [] as string[],
  success: false
};
const windows: BrowserWindow[] = [];
const controllers: Array<{ dispose(): void }> = [];
let finished = false;
function finish(error?: unknown) {
  if (finished) return;
  finished = true;
  if (error)
    evidence.errors.push(
      String(error instanceof Error ? error.message : error)
        .replace(/E:[^\s"']*/gi, '[fixture-path]')
        .slice(0, 400)
    );
  controllers.forEach((controller) => controller.dispose());
  windows.forEach((window) => {
    if (!window.isDestroyed()) window.destroy();
  });
  evidence.success = evidence.errors.length === 0 && Object.values(evidence.checks).every(Boolean);
  writeFileSync(
    join(directory, 'native-evidence.json'),
    JSON.stringify(evidence, null, 2) + '\n',
    'utf8'
  );
  app.exit(evidence.success ? 0 : 1);
}
process.on('uncaughtException', finish);
process.on('unhandledRejection', finish);
app.on('window-all-closed', () => {});
const pause = (milliseconds: number) =>
  new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));

void app
  .whenReady()
  .then(async () => {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] },
      (_details, callback) => {
        evidence.externalRequestsBlocked++;
        callback({ cancel: true });
      }
    );
    const requireNative = createRequire(join(app.getAppPath(), 'package.json'));
    const koffi = requireNative(join(app.getAppPath(), 'resources/taskbar-native/koffi/index.cjs'));
    const load = koffi.load.bind(koffi);
    const processHandle = load(join(process.env.SystemRoot!, 'System32/kernel32.dll')).func(
      'void *__stdcall GetCurrentProcess()'
    )();
    const resourceCount = load(join(process.env.SystemRoot!, 'System32/user32.dll')).func(
      'uint __stdcall GetGuiResources(void *process, uint flags)'
    );
    const postMessage = load(join(process.env.SystemRoot!, 'System32/user32.dll')).func(
      'int __stdcall PostMessageW(void *hwnd, uint message, uint64_t wParam, int64_t lParam)'
    );
    const bitmapHandles = new Set<bigint>();
    const ownedObjects = new Set<bigint>();
    const ownedDCs = new Set<bigint>();
    let failThumbnail = false;
    let failAttribute = false;
    let fakeForeignOwner = false;
    koffi.load = (path: string) => {
      const library = load(path);
      return {
        func(declaration: string) {
          const fn = library.func(declaration);
          const name = declaration.match(/\b([A-Za-z0-9_]+)\(/)![1];
          return (...args: any[]) => {
            const result = fn(...args);
            if (name === 'CreateDIBSection' && result) {
              bitmapHandles.add(result);
              ownedObjects.add(result);
              evidence.bitmapCreates++;
            }
            if (name === 'CreateFontW' && result) ownedObjects.add(result);
            if (name === 'CreateCompatibleDC' && result) ownedDCs.add(result);
            if (name === 'DeleteDC' && result) ownedDCs.delete(args[0]);
            if (name === 'DeleteObject' && result) {
              ownedObjects.delete(args[0]);
              if (bitmapHandles.delete(args[0])) evidence.bitmapDeletes++;
            }
            if (
              [
                'DwmSetWindowAttribute',
                'DwmInvalidateIconicBitmaps',
                'DwmSetIconicThumbnail',
                'DwmSetIconicLivePreviewBitmap',
                'DrawTextW'
              ].includes(name)
            ) {
              const call: Call = { name, result: typeof result === 'number' ? result : null };
              if (name === 'DwmSetWindowAttribute') {
                call.attribute = args[1];
                call.enabled = args[2].readInt32LE(0) === 1;
              }
              if (name === 'DrawTextW') {
                call.text = args[1];
                call.flags = args[4];
              }
              evidence.nativeCalls.push(call);
            }
            if (name === 'DwmSetIconicThumbnail' && failThumbnail) {
              failThumbnail = false;
              return -2147467259;
            }
            if (name === 'DwmSetWindowAttribute' && failAttribute && args[2].readInt32LE(0) === 1) {
              failAttribute = false;
              return -2147467259;
            }
            if (name === 'GetWindowThreadProcessId' && fakeForeignOwner) {
              args[1][0] = process.pid + 1;
              fakeForeignOwner = false;
            }
            return result;
          };
        }
      };
    };
    const createWindow = () => {
      const window = new BrowserWindow({
        width: 720,
        height: 420,
        show: false,
        skipTaskbar: false,
        backgroundColor: '#f5f3ec',
        title: '歌曲卡原生测试 · 自动退出',
        webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true }
      });
      windows.push(window);
      return window;
    };
    const request = async (window: BrowserWindow, live = false, width = 360, height = 180) => {
      const hwnd = window.getNativeWindowHandle().readBigUInt64LE(0);
      const dimensions = BigInt(((width & 0xffff) << 16) | (height & 0xffff));
      if (
        !postMessage(
          hwnd,
          live ? DWM_LIVE_PREVIEW_MESSAGE : DWM_THUMBNAIL_MESSAGE,
          0n,
          live ? 0n : dimensions
        )
      )
        throw new Error('post-message-failed');
      evidence.syntheticRequests++;
      await pause(55);
    };
    const state = { title: '风经过这里', artist: '隔离测试歌手', isPlaying: true };
    for (const [name, cardState, width, height] of [
      ['playing', state, 480, 240],
      [
        'paused-long',
        {
          title: '这是一首用于验证中文长标题自动省略的隔离测试歌曲 · 不会播放任何音乐',
          artist: '测试歌手 / Another Artist',
          isPlaying: false
        },
        480,
        240
      ],
      ['empty', { title: '', artist: '', isPlaying: true }, 480, 240],
      ['small', state, 240, 120]
    ] as const) {
      const card = renderTaskbarPreviewBitmap(cardState, width, height);
      const png = nativeImage
        .createFromBitmap(card.pixels, { width: card.width, height: card.height })
        .toPNG();
      let alphaOpaque = true;
      for (let offset = 3; offset < card.pixels.length; offset += 4)
        if (card.pixels[offset] !== 255) alphaOpaque = false;
      writeFileSync(join(directory, `card-${name}.png`), png);
      evidence.cards.push({
        name,
        width: card.width,
        height: card.height,
        alphaOpaque,
        pngBytes: png.length
      });
    }
    evidence.checks.nativeCardsOpaque = evidence.cards.every(
      (card) => card.alphaOpaque && card.pngBytes > 1000
    );
    evidence.checks.emptyStatePaused =
      normalizePreviewState({ title: '\u0000', artist: 'test', isPlaying: true }).isPlaying ===
      false;
    evidence.checks.sizesBounded =
      fitPreviewSize(65535, 65535)!.width === 480 &&
      fitPreviewSize(120, 50)!.height <= 50 &&
      fitPreviewSize(0, 100) === null &&
      fitPreviewSize(Number.NaN, 50) === null;
    evidence.checks.longTitleEllipsis = evidence.nativeCalls.some(
      (call) => call.name === 'DrawTextW' && call.text!.length > 25 && (call.flags! & 0x8000) !== 0
    );
    const window = createWindow();
    window.showInactive();
    await pause(450);
    const controller = initializeTaskbarPreview(window);
    controllers.push(controller);
    evidence.checks.thumbnailHookInstalled = window.isWindowMessageHooked(DWM_THUMBNAIL_MESSAGE);
    evidence.checks.liveHookInstalled = window.isWindowMessageHooked(DWM_LIVE_PREVIEW_MESSAGE);
    controller.update(state);
    await pause(200);
    await request(window, true);
    evidence.checks.realLivePreviewSucceeded = evidence.nativeCalls.some(
      (call) => call.name === 'DwmSetIconicLivePreviewBitmap' && call.result === 0
    );
    evidence.gdiBefore = resourceCount(processHandle, 0);
    const rapidStart = evidence.nativeCalls.length;
    for (let index = 0; index < 60; index++)
      controller.update({
        title: `快速切歌 ${index}`,
        artist: '测试歌手',
        isPlaying: index % 2 === 0
      });
    await pause(230);
    await request(window, true);
    evidence.checks.latestSongRendered = evidence.nativeCalls
      .slice(rapidStart)
      .some((call) => call.name === 'DrawTextW' && call.text === '快速切歌 59');
    evidence.checks.rapidChangesThrottled =
      evidence.nativeCalls
        .slice(rapidStart)
        .filter((call) => call.name === 'DwmInvalidateIconicBitmaps').length <= 2;
    for (let index = 0; index < 24; index++) await request(window, true);
    evidence.gdiAfter = resourceCount(processHandle, 0);
    evidence.checks.gdiProcessCountStable = evidence.gdiAfter <= evidence.gdiBefore + 2;
    // Outside an actual Explorer thumbnail request, this Windows DWM may reject the synthetic message.
    // Record the real HRESULT and exercise fallback, without claiming Explorer displayed the card.
    await request(window);
    evidence.checks.realThumbnailOutcomeRecorded = evidence.nativeCalls.some(
      (call) =>
        call.name === 'DwmSetIconicThumbnail' && (call.result === 0 || call.result === -2147024809)
    );
    controller.dispose();
    controller.dispose();
    evidence.checks.disposeUnhooks =
      !window.isWindowMessageHooked(DWM_THUMBNAIL_MESSAGE) &&
      !window.isWindowMessageHooked(DWM_LIVE_PREVIEW_MESSAGE);
    const callsBeforeInert = evidence.nativeCalls.length;
    controller.update({ title: '停用后不刷新', artist: '测试', isPlaying: true });
    await pause(230);
    evidence.checks.disposedControllerInert = evidence.nativeCalls.length === callsBeforeInert;
    const failureWindow = createWindow();
    const failureController = initializeTaskbarPreview(failureWindow);
    controllers.push(failureController);
    failureController.update(state);
    failureWindow.showInactive();
    await pause(200);
    const beforeShowStart = evidence.nativeCalls.length;
    await request(failureWindow, true);
    evidence.checks.initializingBeforeShowWorks = evidence.nativeCalls
      .slice(beforeShowStart)
      .some((call) => call.name === 'DwmSetIconicLivePreviewBitmap' && call.result === 0);
    const failStart = evidence.nativeCalls.length;
    failThumbnail = true;
    await request(failureWindow);
    const fallbackCalls = evidence.nativeCalls.slice(failStart);
    evidence.checks.hresultFailureUnhooks =
      !failureWindow.isWindowMessageHooked(DWM_THUMBNAIL_MESSAGE) &&
      !failureWindow.isWindowMessageHooked(DWM_LIVE_PREVIEW_MESSAGE);
    evidence.checks.hresultFailureResetsFlags = [7, 10].every((attribute) =>
      fallbackCalls.some(
        (call) =>
          call.name === 'DwmSetWindowAttribute' &&
          call.attribute === attribute &&
          call.enabled === false &&
          call.result === 0
      )
    );
    failAttribute = true;
    const attributeWindow = createWindow();
    const attributeStart = evidence.nativeCalls.length;
    const attributeController = initializeTaskbarPreview(attributeWindow);
    controllers.push(attributeController);
    evidence.checks.attributeFailureUnhooks =
      !attributeWindow.isWindowMessageHooked(DWM_THUMBNAIL_MESSAGE) &&
      !attributeWindow.isWindowMessageHooked(DWM_LIVE_PREVIEW_MESSAGE);
    evidence.checks.attributeFailureResetsFlags = [7, 10].every((attribute) =>
      evidence.nativeCalls
        .slice(attributeStart)
        .some(
          (call) =>
            call.name === 'DwmSetWindowAttribute' &&
            call.attribute === attribute &&
            call.enabled === false
        )
    );
    fakeForeignOwner = true;
    const foreignWindow = createWindow();
    const foreignStart = evidence.nativeCalls.length;
    const foreignController = initializeTaskbarPreview(foreignWindow);
    controllers.push(foreignController);
    foreignController.update(state);
    evidence.checks.foreignOwnerRejected =
      !foreignWindow.isWindowMessageHooked(DWM_THUMBNAIL_MESSAGE) &&
      evidence.nativeCalls.length === foreignStart;
    const closingWindow = createWindow();
    const closingController = initializeTaskbarPreview(closingWindow);
    controllers.push(closingController);
    closingController.update(state);
    closingController.update({ ...state, title: '关闭前正在排队' });
    closingWindow.destroy();
    const callsBeforeClose = evidence.nativeCalls.length;
    closingController.update(state);
    closingController.dispose();
    await pause(250);
    evidence.checks.closeCancelsPendingRefresh = evidence.nativeCalls.length === callsBeforeClose;
    evidence.checks.bitmapsAllDeleted =
      evidence.bitmapCreates > 25 &&
      evidence.bitmapCreates === evidence.bitmapDeletes &&
      bitmapHandles.size === 0;
    evidence.checks.gdiObjectsAllReleased = ownedObjects.size === 0 && ownedDCs.size === 0;
    evidence.checks.noExternalRequests = evidence.externalRequestsBlocked === 0;
    evidence.checks.fixedRuntimeAsar =
      basename(app.getAppPath()) === 'app.asar' && koffi.version === '3.3.3';
    finish();
  })
  .catch(finish);
setTimeout(() => finish(new Error('fixture-timeout')), 12000).unref();
