type SoundOptions = {
  src: string[];
  onload: () => void;
  onloaderror: (id: number, error: unknown) => void;
};

export class Howl {
  static instances: Howl[] = [];
  unloadCount = 0;
  loaded = false;

  constructor(public options: SoundOptions) {
    Howl.instances.push(this);
  }

  duration(): number {
    return 159;
  }

  state(): string {
    return this.loaded ? 'loaded' : 'loading';
  }

  unload(): void {
    this.unloadCount++;
  }

  complete(): void {
    this.loaded = true;
    this.options.onload();
  }

  fail(error: unknown): void {
    this.options.onloaderror(0, error);
  }
}

export function installPreloadClock() {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let now = 0;
  let nextId = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  globalThis.setTimeout = ((callback: () => void, delay = 0) => {
    const id = ++nextId;
    timers.set(id, { at: now + delay, callback });
    return id;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((id: number | undefined) => {
    if (id !== undefined) timers.delete(id);
  }) as unknown as typeof clearTimeout;
  return {
    pending: () => timers.size,
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
    restore() {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  };
}
