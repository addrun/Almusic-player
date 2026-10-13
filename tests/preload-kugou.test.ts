import assert from 'node:assert/strict';
import { test } from 'node:test';

import { preloadService } from '../src/renderer/services/preloadService';
import type { SongResult } from '../src/renderer/types/music';
import { Howl, installPreloadClock } from './helpers/preload-howl-fixture';

function song(id: string, kugou = true): SongResult {
  return {
    id,
    name: 'Color Your Night.mp3',
    playMusicUrl: 'https://audio.example/test.mp3',
    kugou: kugou ? { albumId: '1' } : undefined
  } as SongResult;
}

test('a valid song ID without a playback URL rejects without constructing audio', async () => {
  const before = Howl.instances.length;
  await assert.rejects(
    preloadService.load({ ...song('missing-url'), playMusicUrl: undefined }),
    /歌曲没有 URL/
  );
  assert.equal(Howl.instances.length, before);
  assert.equal(preloadService.getPreloadedSound('missing-url'), undefined);
});

test('successful imported audio clears its timeout and preserves the loaded sound', async () => {
  const clock = installPreloadClock();
  try {
    const entry = song('success');
    const promise = preloadService.load(entry);
    const sound = Howl.instances.at(-1)!;
    assert.equal(clock.pending(), 1);
    sound.complete();
    assert.equal(await promise, sound);
    assert.equal(clock.pending(), 0);
    clock.advance(12000);
    assert.equal(sound.unloadCount, 0);
    assert.equal(await preloadService.load(entry), sound);
  } finally {
    preloadService.clearAll();
    clock.restore();
  }
});

test('imported audio times out at 12 seconds, unloads once, and can load a replacement', async () => {
  const clock = installPreloadClock();
  try {
    const entry = song('timeout');
    const promise = preloadService.load(entry);
    const failed = Howl.instances.at(-1)!;
    const rejection = assert.rejects(promise, /酷狗音频加载超时/);
    clock.advance(11999);
    assert.equal(failed.unloadCount, 0);
    clock.advance(1);
    await rejection;
    assert.equal(failed.unloadCount, 1);
    assert.equal(clock.pending(), 0);
    failed.complete();
    assert.equal(preloadService.getPreloadedSound(entry.id), undefined);
    const replacement = preloadService.load(entry);
    const loaded = Howl.instances.at(-1)!;
    assert.notEqual(loaded, failed);
    loaded.complete();
    assert.equal(await replacement, loaded);
    assert.equal(clock.pending(), 0);
  } finally {
    preloadService.clearAll();
    clock.restore();
  }
});

test('loaderror clears the timer and unloads the failed audio exactly once', async () => {
  const clock = installPreloadClock();
  try {
    const promise = preloadService.load(song('loaderror'));
    const sound = Howl.instances.at(-1)!;
    const rejection = assert.rejects(promise, (error) => error === 4);
    sound.fail(4);
    await rejection;
    assert.equal(sound.unloadCount, 1);
    assert.equal(clock.pending(), 0);
    sound.fail(4);
    clock.advance(12000);
    assert.equal(sound.unloadCount, 1);
  } finally {
    preloadService.clearAll();
    clock.restore();
  }
});

test('other platforms receive no Kugou timeout and may complete after 12 seconds', async () => {
  const clock = installPreloadClock();
  try {
    const promise = preloadService.load(song('netease', false));
    const sound = Howl.instances.at(-1)!;
    assert.equal(clock.pending(), 0);
    clock.advance(20000);
    assert.equal(sound.unloadCount, 0);
    sound.complete();
    assert.equal(await promise, sound);
    assert.equal(clock.pending(), 0);
  } finally {
    preloadService.clearAll();
    clock.restore();
  }
});

test('a new URL for the same imported ID replaces cached audio instead of returning the old sound', async () => {
  const clock = installPreloadClock();
  try {
    const entry = song('url-aware');
    const firstLoad = preloadService.load(entry);
    const oldSound = Howl.instances.at(-1)!;
    oldSound.complete();
    await firstLoad;
    const secondLoad = preloadService.load({
      ...entry,
      playMusicUrl: 'https://audio.example/new.mp3'
    });
    const newSound = Howl.instances.at(-1)!;
    assert.notEqual(newSound, oldSound);
    assert.equal(oldSound.unloadCount, 1);
    newSound.complete();
    assert.equal(await secondLoad, newSound);
    assert.equal(preloadService.consume(entry.id, 'https://audio.example/another.mp3'), undefined);
    assert.equal(newSound.unloadCount, 1);
  } finally {
    preloadService.clearAll();
    clock.restore();
  }
});

test('binding cancellation aborts pending audio and late old completion cannot overwrite its replacement', async () => {
  const clock = installPreloadClock();
  try {
    const entry = song('cancel-loading');
    const firstLoad = preloadService.load(entry);
    const oldSound = Howl.instances.at(-1)!;
    const cancelled = assert.rejects(firstLoad, /预加载已取消/);
    preloadService.cancel(entry.id);
    assert.equal(oldSound.unloadCount, 1);
    assert.equal(clock.pending(), 0);
    const secondLoad = preloadService.load({
      ...entry,
      playMusicUrl: 'https://audio.example/bound.mp3'
    });
    const newSound = Howl.instances.at(-1)!;
    oldSound.complete();
    await cancelled;
    newSound.complete();
    assert.equal(await secondLoad, newSound);
    assert.equal(preloadService.getPreloadedSound(entry.id), newSound);
    assert.equal(clock.pending(), 0);
  } finally {
    preloadService.clearAll();
    clock.restore();
  }
});

test('a changed URL cancels a pending load while keeping the replacement promise isolated', async () => {
  const clock = installPreloadClock();
  try {
    const entry = song('pending-url');
    const original = preloadService.load(entry);
    const oldSound = Howl.instances.at(-1)!;
    const cancelled = assert.rejects(original, /预加载已取消/);
    const replacement = { ...entry, playMusicUrl: 'https://audio.example/replacement.mp3' };
    const second = preloadService.load(replacement);
    const newSound = Howl.instances.at(-1)!;
    await cancelled;
    const third = preloadService.load(replacement);
    assert.equal(Howl.instances.at(-1), newSound);
    assert.equal(oldSound.unloadCount, 1);
    newSound.complete();
    assert.equal(await second, newSound);
    assert.equal(await third, newSound);
  } finally {
    preloadService.clearAll();
    clock.restore();
  }
});
