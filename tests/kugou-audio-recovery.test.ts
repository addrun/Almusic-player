import assert from 'node:assert/strict';
import { test } from 'node:test';

import { recoverKugouAudio } from '../src/renderer/services/kugouAudioRecovery';

test('two unusable URLs advance to the third playable candidate and reject each failed URL', async () => {
  const loaded: string[] = [];
  const rejected: string[] = [];
  const replacements = ['second', 'third'];
  let cancelled = 0;
  const result = await recoverKugouAudio({
    url: 'first',
    load: async (url) => {
      loaded.push(url);
      if (url !== 'third') throw new Error('audio load failed');
      return { url };
    },
    resolve: async () => replacements.shift(),
    reject: (url) => rejected.push(url),
    cancelLoad: () => cancelled++,
    dispose: () => {},
    isActive: () => true
  });
  assert.deepEqual(result, { sound: { url: 'third' }, url: 'third' });
  assert.deepEqual(loaded, ['first', 'second', 'third']);
  assert.deepEqual(rejected, ['first', 'second']);
  assert.equal(cancelled, 2);
});

test('four failed loads reject all four addresses and never ask for a fourth replacement', async () => {
  const loaded: string[] = [];
  const rejected: string[] = [];
  let resolutions = 0;
  await assert.rejects(
    recoverKugouAudio({
      url: 'initial',
      load: async (url) => {
        loaded.push(url);
        throw new Error('no playable audio');
      },
      resolve: async () => `replacement-${++resolutions}`,
      reject: (url) => rejected.push(url),
      cancelLoad: () => {},
      dispose: () => {},
      isActive: () => true
    }),
    /no playable audio/
  );
  assert.equal(resolutions, 3);
  assert.equal(loaded.length, 4);
  assert.deepEqual(rejected, loaded);
});

test('repeated resolver addresses never reload rejected audio and still allow a later fresh address', async () => {
  const loaded: string[] = [];
  const replacements = ['initial', 'initial', 'fresh'];
  const result = await recoverKugouAudio({
    url: 'initial',
    load: async (url) => {
      loaded.push(url);
      if (url === 'initial') throw new Error('bad audio');
      return url;
    },
    resolve: async () => replacements.shift(),
    reject: () => {},
    cancelLoad: () => {},
    dispose: () => {},
    isActive: () => true
  });
  assert.deepEqual(loaded, ['initial', 'fresh']);
  assert.deepEqual(result, { sound: 'fresh', url: 'fresh' });
});

test('pause during a pending resolution exits quietly and does not load its late result', async () => {
  let active = true;
  let resolveLate!: (url: string) => void;
  let loads = 0;
  let cancelLoads = 0;
  const recovery = recoverKugouAudio({
    url: 'initial',
    load: async () => {
      loads++;
      throw new Error('bad initial');
    },
    resolve: () =>
      new Promise<string>((resolve) => {
        resolveLate = resolve;
      }),
    reject: () => {},
    cancelLoad: () => cancelLoads++,
    dispose: () => {},
    isActive: () => active,
    budgetMs: 1000
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  active = false;
  assert.equal(await recovery, null);
  resolveLate('late');
  await Promise.resolve();
  assert.equal(loads, 1);
  assert.equal(cancelLoads, 2);
});

test('hanging audio obeys the total budget and disposes any late successful load', async () => {
  let loadLate!: (sound: string) => void;
  const disposed: string[] = [];
  const rejected: string[] = [];
  let cancellations = 0;
  const recovery = recoverKugouAudio({
    url: 'hung',
    load: () =>
      new Promise<string>((resolve) => {
        loadLate = resolve;
      }),
    resolve: async () => 'must-not-run',
    reject: (url) => rejected.push(url),
    cancelLoad: () => cancellations++,
    dispose: (sound) => disposed.push(sound),
    isActive: () => true,
    budgetMs: 15
  });
  await assert.rejects(recovery, /酷狗备用播放已超时/);
  assert.deepEqual(rejected, ['hung']);
  assert.ok(cancellations >= 1);
  loadLate('obsolete sound');
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(disposed, ['obsolete sound']);
});

test('hanging resolver obeys the same total budget after an audio failure', async () => {
  let loads = 0;
  await assert.rejects(
    recoverKugouAudio({
      url: 'initial',
      load: async () => {
        loads++;
        throw new Error('bad audio');
      },
      resolve: () => new Promise<string>(() => {}),
      reject: () => {},
      cancelLoad: () => {},
      dispose: () => {},
      isActive: () => true,
      budgetMs: 15
    }),
    /酷狗备用播放已超时/
  );
  assert.equal(loads, 1);
});
