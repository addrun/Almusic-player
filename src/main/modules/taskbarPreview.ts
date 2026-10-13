/** Windows x64 DWM card, drawn and submitted in this Electron main process. */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join } from 'node:path';

import type { BrowserWindow } from 'electron';
import { app } from 'electron';

export interface TaskbarPreviewState {
  title: string;
  artist: string;
  isPlaying: boolean;
}

export interface TaskbarPreviewController {
  update(state: TaskbarPreviewState): void;
  dispose(): void;
}

export const DWM_THUMBNAIL_MESSAGE = 0x0323;
export const DWM_LIVE_PREVIEW_MESSAGE = 0x0326;
const FORCE_ICONIC = 7;
const HAS_ICONIC = 10;
const CARD_WIDTH = 480;
const CARD_HEIGHT = 240;
const MAX_LIVE_WIDTH = 960;
const MAX_LIVE_HEIGHT = 480;
const REFRESH_INTERVAL = 180;

type Pointer = bigint | null;
type NativeFunction = (...args: any[]) => any;
interface KoffiLibrary {
  func(declaration: string): NativeFunction;
}
interface KoffiRuntime {
  version: string;
  load(path: string): KoffiLibrary;
}
interface Bindings {
  SetAttribute: NativeFunction;
  Invalidate: NativeFunction;
  Thumbnail: NativeFunction;
  LivePreview: NativeFunction;
  RegisterMessage: NativeFunction;
  Owner: NativeFunction;
  GetClientRect: NativeFunction;
  CreateDC: NativeFunction;
  DeleteDC: NativeFunction;
  CreateBitmap: NativeFunction;
  SelectObject: NativeFunction;
  DeleteObject: NativeFunction;
  CreateFont: NativeFunction;
  SetTextColor: NativeFunction;
  SetBkMode: NativeFunction;
  DrawText: NativeFunction;
  Flush: NativeFunction;
  CopyMemory: NativeFunction;
}
let bindings: Bindings | null = null;

function getBindings(): Bindings {
  if (bindings) return bindings;
  const requireNative = createRequire(join(app.getAppPath(), 'package.json'));
  const koffi = requireNative(
    join(app.getAppPath(), 'resources/taskbar-native/koffi/index.cjs')
  ) as KoffiRuntime;
  if (koffi.version !== '3.3.3') throw new Error('native-version');
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot || !isAbsolute(systemRoot)) throw new Error('system-directory');
  const dll = (name: string) => {
    const path = join(systemRoot, 'System32', name);
    if (!existsSync(path)) throw new Error('system-library');
    return koffi.load(path);
  };
  const dwm = dll('dwmapi.dll');
  const user = dll('user32.dll');
  const gdi = dll('gdi32.dll');
  const nt = dll('ntdll.dll');
  const native: Bindings = {
    SetAttribute: dwm.func(
      'int __stdcall DwmSetWindowAttribute(void *hwnd, uint attribute, const void *value, uint size)'
    ),
    Invalidate: dwm.func('int __stdcall DwmInvalidateIconicBitmaps(void *hwnd)'),
    Thumbnail: dwm.func(
      'int __stdcall DwmSetIconicThumbnail(void *hwnd, void *bitmap, uint flags)'
    ),
    LivePreview: dwm.func(
      'int __stdcall DwmSetIconicLivePreviewBitmap(void *hwnd, void *bitmap, const void *offset, uint flags)'
    ),
    RegisterMessage: user.func('uint __stdcall RegisterWindowMessageW(str16 name)'),
    Owner: user.func('uint __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint *pid)'),
    GetClientRect: user.func('int __stdcall GetClientRect(void *hwnd, _Out_ void *rect)'),
    CreateDC: gdi.func('void *__stdcall CreateCompatibleDC(void *dc)'),
    DeleteDC: gdi.func('int __stdcall DeleteDC(void *dc)'),
    CreateBitmap: gdi.func(
      'void *__stdcall CreateDIBSection(void *dc, const void *info, uint usage, _Out_ void **bits, void *section, uint offset)'
    ),
    SelectObject: gdi.func('void *__stdcall SelectObject(void *dc, void *object)'),
    DeleteObject: gdi.func('int __stdcall DeleteObject(void *object)'),
    CreateFont: gdi.func(
      'void *__stdcall CreateFontW(int height, int width, int escapement, int orientation, int weight, uint italic, uint underline, uint strikeout, uint charset, uint outPrecision, uint clipPrecision, uint quality, uint pitch, str16 face)'
    ),
    SetTextColor: gdi.func('uint __stdcall SetTextColor(void *dc, uint color)'),
    SetBkMode: gdi.func('int __stdcall SetBkMode(void *dc, int mode)'),
    DrawText: user.func(
      'int __stdcall DrawTextW(void *dc, str16 text, int count, void *rect, uint format)'
    ),
    Flush: gdi.func('int __stdcall GdiFlush()'),
    CopyMemory: nt.func(
      'void __stdcall RtlMoveMemory(void *destination, const void *source, size_t length)'
    )
  };
  bindings = native;
  return native;
}

export function getTaskbarButtonCreatedMessage(): number | null {
  if (process.platform !== 'win32' || process.arch !== 'x64') return null;
  try {
    const message = getBindings().RegisterMessage('TaskbarButtonCreated');
    return Number.isInteger(message) && message >= 0xc000 && message <= 0xffff ? message : null;
  } catch {
    return null;
  }
}

function hasPointer(value: Pointer): value is bigint {
  return (
    typeof value === 'bigint' && value !== 0n && value !== -1n && value !== 0xffffffffffffffffn
  );
}

/** Single lines only; bounds also prevent excessive work on renderer-supplied metadata. */
export function normalizePreviewState(value: TaskbarPreviewState): TaskbarPreviewState {
  const line = (text: unknown) =>
    typeof text === 'string'
      ? text
          // Strip native string terminators and metadata control characters.
          // eslint-disable-next-line no-control-regex
          .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 180)
      : '';
  const title = line(value?.title);
  return { title, artist: line(value?.artist), isPlaying: Boolean(title && value?.isPlaying) };
}

export function fitPreviewSize(maxWidth: number, maxHeight: number, live = false) {
  if (!Number.isFinite(maxWidth) || !Number.isFinite(maxHeight) || maxWidth < 1 || maxHeight < 1)
    return null;
  const scale = Math.min(
    Math.floor(maxWidth) / CARD_WIDTH,
    Math.floor(maxHeight) / CARD_HEIGHT,
    live ? MAX_LIVE_WIDTH / CARD_WIDTH : 1,
    live ? MAX_LIVE_HEIGHT / CARD_HEIGHT : 1
  );
  return {
    width: Math.max(1, Math.floor(CARD_WIDTH * scale)),
    height: Math.max(1, Math.floor(CARD_HEIGHT * scale))
  };
}

interface CardBitmap {
  handle: bigint;
  width: number;
  height: number;
  pixels: Buffer;
  dispose(): void;
}

const palette = {
  background: [245, 243, 236],
  green: [115, 125, 97],
  dark: [43, 50, 38],
  muted: [120, 125, 114],
  record: [228, 230, 215],
  ring: [202, 209, 190]
} as const;

function colorRef(rgb: readonly number[]) {
  return rgb[0] | (rgb[1] << 8) | (rgb[2] << 16);
}

/** Pixels are BGRA and top-down. No external buffers: Electron forbids those on some builds. */
function createCard(
  native: Bindings,
  state: TaskbarPreviewState,
  width: number,
  height: number
): CardBitmap {
  let dc: Pointer = null;
  let bitmap: Pointer = null;
  let oldBitmap: Pointer = null;
  let success = false;
  const pixels = Buffer.alloc(width * height * 4);
  const info = Buffer.alloc(44);
  info.writeUInt32LE(40, 0);
  info.writeInt32LE(width, 4);
  info.writeInt32LE(-height, 8);
  info.writeUInt16LE(1, 12);
  info.writeUInt16LE(32, 14);
  info.writeUInt32LE(pixels.length, 20);
  try {
    dc = native.CreateDC(null);
    if (!hasPointer(dc)) throw new Error('create-dc');
    const bits: Pointer[] = [null];
    bitmap = native.CreateBitmap(dc, info, 0, bits, null, 0);
    if (!hasPointer(bitmap) || !hasPointer(bits[0])) throw new Error('create-bitmap');
    oldBitmap = native.SelectObject(dc, bitmap);
    if (!hasPointer(oldBitmap)) throw new Error('select-bitmap');
    const scale = width / CARD_WIDTH;
    const setPixel = (x: number, y: number, color: readonly number[]) => {
      const offset = (y * width + x) * 4;
      pixels[offset] = color[2];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[0];
      pixels[offset + 3] = 255;
    };
    // Soft abstract record and tiny transport mark; no album or network dependency.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = (x + 0.5) / scale;
        const py = (y + 0.5) / scale;
        const distance = Math.hypot(px - 74, py - 110);
        let color: readonly number[] = palette.background;
        if (distance <= 45) color = palette.record;
        if (Math.abs(distance - 38) < 0.7 || Math.abs(distance - 29) < 0.7) color = palette.ring;
        if (distance <= 13) color = palette.green;
        if (distance <= 3) color = palette.background;
        if (state.isPlaying && px >= 28 && px <= 120) {
          const lineX = Math.round((px - 30) / 6);
          const lineCenter = 30 + lineX * 6;
          const amplitude = 5 + (lineX % 5) * 3;
          if (Math.abs(px - lineCenter) <= 1 && Math.abs(py - 175) <= amplitude)
            color = palette.green;
        }
        setPixel(x, y, color);
      }
    }
    native.CopyMemory(bits[0], pixels, pixels.length);
    native.SetBkMode(dc, 1); // TRANSPARENT
    const drawText = (
      text: string,
      x: number,
      y: number,
      available: number,
      fontSize: number,
      weight: number,
      color: readonly number[]
    ) => {
      if (!text || width < 80 || height < 40) return;
      const font = native.CreateFont(
        -Math.max(7, Math.round(fontSize * scale)),
        0,
        0,
        0,
        weight,
        0,
        0,
        0,
        1,
        0,
        0,
        4,
        0,
        'Microsoft YaHei UI'
      ) as Pointer;
      if (!hasPointer(font)) throw new Error('create-font');
      let previous: Pointer = null;
      try {
        previous = native.SelectObject(dc, font);
        if (!hasPointer(previous)) throw new Error('select-font');
        native.SetTextColor(dc, colorRef(color));
        const rectangle = Buffer.alloc(16);
        rectangle.writeInt32LE(Math.round(x * scale), 0);
        rectangle.writeInt32LE(Math.round(y * scale), 4);
        rectangle.writeInt32LE(Math.min(width - 4, Math.round((x + available) * scale)), 8);
        rectangle.writeInt32LE(Math.min(height, Math.round((y + fontSize * 1.8) * scale)), 12);
        // DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS | DT_NOPREFIX, real UTF-16 text.
        if (
          !native.DrawText(
            dc,
            text,
            text.length,
            rectangle,
            0x00000020 | 0x00000004 | 0x00008000 | 0x00000800
          )
        ) {
          throw new Error('draw-text');
        }
      } finally {
        if (hasPointer(previous)) native.SelectObject(dc, previous);
        native.DeleteObject(font);
      }
    };
    drawText('ALMUSIC', 146, 26, 304, 12, 600, palette.green);
    drawText(state.title || '还没有播放歌曲', 146, 68, 302, 23, 600, palette.dark);
    drawText(
      state.title ? state.artist || '未知歌手' : '选一首喜欢的音乐',
      146,
      109,
      300,
      15,
      400,
      palette.muted
    );
    drawText(
      state.title ? (state.isPlaying ? '正在播放' : '已暂停') : '等待播放',
      146,
      172,
      300,
      13,
      500,
      palette.green
    );
    if (!native.Flush()) throw new Error('gdi-flush');
    native.CopyMemory(pixels, bits[0], pixels.length);
    // GDI may clear alpha in text pixels. DWM needs a fully opaque 32-bit image.
    for (let offset = 3; offset < pixels.length; offset += 4) pixels[offset] = 255;
    native.CopyMemory(bits[0], pixels, pixels.length);
    const handle = bitmap;
    let disposed = false;
    success = true;
    return {
      handle,
      width,
      height,
      pixels,
      dispose() {
        if (disposed) return;
        disposed = true;
        native.DeleteObject(handle);
      }
    };
  } finally {
    if (hasPointer(dc)) {
      if (hasPointer(oldBitmap)) native.SelectObject(dc, oldBitmap);
      native.DeleteDC(dc);
    }
    if (!success && hasPointer(bitmap)) native.DeleteObject(bitmap);
  }
}

/** Independent fixture snapshot of the same native card; it never reads player state. */
export function renderTaskbarPreviewBitmap(
  state: TaskbarPreviewState,
  maxWidth = CARD_WIDTH,
  maxHeight = CARD_HEIGHT
) {
  const size = fitPreviewSize(maxWidth, maxHeight);
  if (!size) throw new Error('bitmap-size');
  const card = createCard(getBindings(), normalizePreviewState(state), size.width, size.height);
  try {
    return { width: card.width, height: card.height, pixels: Buffer.from(card.pixels) };
  } finally {
    card.dispose();
  }
}

/** No independent IPC. Parent provides the already-validated taskbar state. */
export function initializeTaskbarPreview(window: BrowserWindow): TaskbarPreviewController {
  const inert: TaskbarPreviewController = { update() {}, dispose() {} };
  if (process.platform !== 'win32' || process.arch !== 'x64' || window.isDestroyed()) return inert;
  let native: Bindings;
  let hwnd: bigint;
  try {
    native = getBindings();
    const handle = window.getNativeWindowHandle();
    if (handle.length < 8) throw new Error('window-handle');
    hwnd = handle.readBigUInt64LE(0);
    const owner = [0];
    if (!native.Owner(hwnd, owner) || owner[0] !== process.pid) throw new Error('window-owner');
  } catch {
    console.warn('[Taskbar] 歌曲预览不可用，保留窗口预览。');
    return inert;
  }
  let disposed = false;
  let flagsAttempted = false;
  let thumbnailHooked = false;
  let liveHooked = false;
  let state: TaskbarPreviewState = { title: '', artist: '', isPlaying: false };
  let signature = '';
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let lastRefresh = 0;
  const alive = () => !disposed && !window.isDestroyed();
  const cancelRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
  };
  const attribute = (name: number, enabled: boolean) => {
    const value = Buffer.alloc(4);
    value.writeInt32LE(enabled ? 1 : 0);
    return native.SetAttribute(hwnd, name, value, value.length) === 0;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelRefresh();
    window.removeListener('closed', dispose);
    if (window.isDestroyed()) return;
    try {
      if (thumbnailHooked) window.unhookWindowMessage(DWM_THUMBNAIL_MESSAGE);
    } catch {
      /* Closing native window. */
    }
    try {
      if (liveHooked) window.unhookWindowMessage(DWM_LIVE_PREVIEW_MESSAGE);
    } catch {
      /* Closing native window. */
    }
    if (flagsAttempted) {
      // These flags are set-only. The ordinary Electron thumbnail uses both as false.
      try {
        attribute(HAS_ICONIC, false);
      } catch {
        /* Preserve best-effort fallback. */
      }
      try {
        attribute(FORCE_ICONIC, false);
      } catch {
        /* Preserve best-effort fallback. */
      }
      try {
        native.Invalidate(hwnd);
      } catch {
        /* Closing native window. */
      }
    }
  };
  const fallback = () => {
    console.warn('[Taskbar] 歌曲预览调用失败，已恢复窗口预览。');
    dispose();
  };
  const submit = (live: boolean, maxWidth: number, maxHeight: number) => {
    if (!alive()) return;
    const size = fitPreviewSize(maxWidth, maxHeight, live);
    if (!size) return;
    let card: CardBitmap | undefined;
    try {
      card = createCard(native, state, size.width, size.height);
      if (!alive()) return;
      const result = live
        ? native.LivePreview(hwnd, card.handle, null, 0)
        : native.Thumbnail(hwnd, card.handle, 0);
      if (result !== 0) fallback();
    } catch {
      fallback();
    } finally {
      card?.dispose();
    }
  };
  const onThumbnail = (_wParam: Buffer, lParam: Buffer) => {
    if (!alive() || lParam.length < 4) return;
    const dimensions = lParam.readUInt32LE(0);
    submit(false, (dimensions >>> 16) & 0xffff, dimensions & 0xffff);
  };
  const onLivePreview = () => {
    if (!alive()) return;
    try {
      const rectangle = Buffer.alloc(16);
      if (!native.GetClientRect(hwnd, rectangle)) {
        fallback();
        return;
      }
      submit(
        true,
        rectangle.readInt32LE(8) - rectangle.readInt32LE(0),
        rectangle.readInt32LE(12) - rectangle.readInt32LE(4)
      );
    } catch {
      fallback();
    }
  };
  const refresh = () => {
    refreshTimer = null;
    if (!alive()) return;
    try {
      lastRefresh = Date.now();
      if (native.Invalidate(hwnd) !== 0) fallback();
    } catch {
      fallback();
    }
  };
  try {
    // Do not overwrite any other component's native hooks.
    if (
      window.isWindowMessageHooked(DWM_THUMBNAIL_MESSAGE) ||
      window.isWindowMessageHooked(DWM_LIVE_PREVIEW_MESSAGE)
    )
      throw new Error('existing-hooks');
    window.hookWindowMessage(DWM_THUMBNAIL_MESSAGE, onThumbnail);
    thumbnailHooked = true;
    window.hookWindowMessage(DWM_LIVE_PREVIEW_MESSAGE, onLivePreview);
    liveHooked = true;
    flagsAttempted = true;
    if (!attribute(FORCE_ICONIC, true) || !attribute(HAS_ICONIC, true))
      throw new Error('dwm-attributes');
    window.once('closed', dispose);
    refresh();
  } catch {
    fallback();
    return inert;
  }
  return {
    update(value) {
      if (!alive()) return;
      const next = normalizePreviewState(value);
      const nextSignature = JSON.stringify([next.title, next.artist, next.isPlaying]);
      if (signature === nextSignature) return;
      state = next;
      signature = nextSignature;
      if (refreshTimer) return;
      const delay = Math.max(0, REFRESH_INTERVAL - (Date.now() - lastRefresh));
      refreshTimer = setTimeout(refresh, delay);
      refreshTimer.unref();
    },
    dispose
  };
}
