import { Howler } from 'howler';

import { isElectron } from '@/utils';

type EventCallback = (...args: any[]) => void;

export class LocalAudioPlayer {
  private _buffer: AudioBuffer | null = null;
  private _source: AudioBufferSourceNode | null = null;
  private _inputNode: GainNode;
  private _playState: 'loading' | 'loaded' | 'unloaded' | 'error' = 'loading';
  private _url: string = '';
  private _position: number = 0;
  private _startWallTime: number = 0;
  private _rate: number = 1;
  private _isPlaying: boolean = false;
  private _duration: number = 0;
  private _loadPromise: Promise<this>;
  private _ctx: AudioContext;
  private _events: Map<string, Set<EventCallback>> = new Map();

  constructor(url: string) {
    this._url = url;
    this._ctx = (Howler.ctx || new AudioContext()) as AudioContext;
    this._inputNode = this._ctx.createGain();
    this._loadPromise = this._load();
  }

  getInputNode(): GainNode {
    return this._inputNode;
  }

  private _localUrlToPath(url: string): string {
    let path = url.replace(/^local:\/{2,3}/, '');
    path = decodeURIComponent(path);
    return path;
  }

  private async _load(): Promise<this> {
    try {
      let arrayBuffer: ArrayBuffer;

      if (isElectron && this._url.startsWith('local://')) {
        const filePath = this._localUrlToPath(this._url);
        const result: unknown = await (window as any).electron.ipcRenderer.invoke(
          'read-file-binary',
          filePath
        );
        if (!result) throw new Error('文件读取失败');
        const uint8 = result as Uint8Array;
        arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
      } else if (!this._url.startsWith('local://')) {
        const response = await fetch(this._url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        arrayBuffer = await response.arrayBuffer();
      } else {
        throw new Error('非 Electron 环境无法加载本地文件');
      }

      this._buffer = await this._ctx.decodeAudioData(arrayBuffer);
      this._duration = this._buffer.duration;
      this._playState = 'loaded';
      this.emit('load');
      return this;
    } catch (err) {
      this._playState = 'error';
      this.emit('loaderror', err);
      throw err;
    }
  }

  load(): Promise<this> {
    return this._loadPromise;
  }

  state(): string {
    return this._playState;
  }

  playing(_soundId?: number): boolean {
    return this._isPlaying;
  }

  duration(_soundId?: number): number {
    return this._duration;
  }

  seek(offset?: number, _soundId?: number): number | void {
    if (offset === undefined) {
      if (!this._isPlaying) return this._position;
      const elapsed = ((performance.now() - this._startWallTime) / 1000) * this._rate;
      return Math.min(this._position + elapsed, this._duration);
    }
    this._position = Math.max(0, Math.min(offset, this._duration));
    if (this._isPlaying) {
      this._stopSource();
      this._startSource(this._position);
    }
  }

  rate(r?: number, _soundId?: number): number | void {
    if (r !== undefined) {
      this._rate = r;
      if (this._isPlaying && this._source) {
        this._source.playbackRate.value = r;
      }
      return;
    }
    return this._rate;
  }

  play(_soundId?: number): number {
    if (this._playState !== 'loaded' || !this._buffer) return 0;
    if (this._position >= this._duration) {
      this._position = 0;
    }
    this._startSource(this._position);
    this._isPlaying = true;
    this.emit('play');
    return 0;
  }

  pause(_soundId?: number): void {
    if (!this._isPlaying) return;
    if (this._source) {
      const elapsed = ((performance.now() - this._startWallTime) / 1000) * this._rate;
      this._position = Math.min(this._position + elapsed, this._duration);
    }
    this._stopSource();
    this._isPlaying = false;
  }

  stop(_soundId?: number): void {
    this._stopSource();
    this._position = 0;
    this._isPlaying = false;
    this.emit('stop');
  }

  unload(): void {
    this._stopSource();
    this._buffer = null;
    this._duration = 0;
    this._position = 0;
    this._isPlaying = false;
    this._playState = 'unloaded';
    try { this._inputNode.disconnect(); } catch {}
    this._events.clear();
  }

  volume(v?: number, _soundId?: number): number | void {
    if (v !== undefined) {
      this._inputNode.gain.value = v;
      return;
    }
    return this._inputNode.gain.value;
  }

  on(event: string, cb: EventCallback): void {
    if (!this._events.has(event)) this._events.set(event, new Set());
    this._events.get(event)!.add(cb);
  }

  off(event: string, cb?: EventCallback): void {
    if (!cb) {
      this._events.delete(event);
      return;
    }
    const handlers = this._events.get(event);
    if (handlers) handlers.delete(cb);
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this._events.get(event);
    if (handlers) handlers.forEach((cb) => cb(...args));
  }

  private _startSource(offset: number): void {
    this._stopSource();
    if (!this._buffer) return;

    const source = this._ctx.createBufferSource();
    source.buffer = this._buffer;
    source.playbackRate.value = this._rate;
    source.connect(this._inputNode);

    source.start(0, offset);
    source.onended = () => {
      if (!this._isPlaying) return;
      this._isPlaying = false;
      this._position = 0;
      this.emit('end');
    };

    this._source = source;
    this._startWallTime = performance.now();
    this._position = offset;
  }

  private _stopSource(): void {
    if (this._source) {
      try {
        this._source.onended = null;
        this._source.stop();
      } catch {}
      try { this._source.disconnect(); } catch {}
      this._source = null;
    }
  }

  get _state(): string {
    return this._playState;
  }
}
