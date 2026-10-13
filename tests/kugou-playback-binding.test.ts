import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import type { SongResult } from '../src/renderer/types/music';
import {
  clearKugouPlaybackBinding,
  getKugouPlaybackBinding,
  setKugouPlaybackBinding
} from '../src/renderer/utils/kugouPlaybackBinding';

const storage = new Map<string, string>();
const original = {
  id: 'kugou:original',
  name: '烟花易冷 (R&B版).mp3',
  ar: [{ name: 'DinDin' }],
  platform: 'kugou',
  platformId: 'A'.repeat(32),
  kugou: { albumId: '123' }
} as SongResult;
const selected = {
  id: 'search-result',
  name: 'DinDin《烟花易冷 (R&B版)》',
  ar: [{ name: '李同学yy' }],
  al: { name: '这首，我快听包浆了' },
  platform: 'kugou',
  platformId: 'B'.repeat(32),
  playMusicUrl: 'https://audio.invalid/signed?token=private',
  dt: 227000,
  kugou: { albumId: 'secret' },
  song: { cookie: 'private' },
  token: 'private'
} as SongResult;

beforeEach(() => {
  storage.clear();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value)
    }
  });
});

test('different title and uploader require explicit selection and survive a new playlist identity', () => {
  const snapshot = JSON.stringify(original);
  assert.equal(getKugouPlaybackBinding(original), null);
  setKugouPlaybackBinding(original, selected);
  const bound = getKugouPlaybackBinding({ ...original, id: 'kugou:resynced' });
  assert.equal(bound?.name, selected.name);
  assert.equal(bound?.ar[0].name, '李同学yy');
  assert.equal(bound?.platformId, selected.platformId);
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(getKugouPlaybackBinding({ ...original, platformId: 'C'.repeat(32) }), null);
});

test('saved preference contains catalogue identity without signed URLs or private nested fields', () => {
  setKugouPlaybackBinding(original, selected);
  const raw = [...storage.values()][0];
  assert.doesNotMatch(raw, /signed|token|cookie|private|kugou.*albumId|playMusicUrl/);
  const bound = getKugouPlaybackBinding(original)!;
  assert.equal(bound.kugou, undefined);
  assert.equal(bound.playMusicUrl, undefined);
  assert.equal(bound.song, undefined);
});

test('bindings can be removed without affecting another original song', () => {
  const other = { ...original, platformId: 'D'.repeat(32) };
  setKugouPlaybackBinding(original, selected);
  setKugouPlaybackBinding(other, selected);
  clearKugouPlaybackBinding(original);
  assert.equal(getKugouPlaybackBinding(original), null);
  assert.ok(getKugouPlaybackBinding(other));
});

test('only a valid catalogue identity is accepted, with numeric NetEase ID restored', () => {
  for (const candidate of [
    { ...selected, platform: 'local', platformId: 'C:/audio.mp3' },
    { ...selected, platform: 'netease', id: 'bad-id' },
    { ...selected, platformId: undefined },
    { ...selected, ar: [] }
  ])
    assert.throws(() => setKugouPlaybackBinding(original, candidate));
  setKugouPlaybackBinding(original, { ...selected, platform: 'netease', id: 5112 });
  assert.equal(getKugouPlaybackBinding(original)?.id, 5112);
  assert.equal(getKugouPlaybackBinding(original)?.platformId, undefined);
  assert.equal(getKugouPlaybackBinding({ ...original, kugou: undefined }), null);
});

test('corrupt local preferences do not stop playback, and save failures are reported', () => {
  storage.set('kugouPlaybackBindings.v1', '{bad json');
  assert.equal(getKugouPlaybackBinding(original), null);
  Object.assign(globalThis, {
    localStorage: {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('quota');
      }
    }
  });
  assert.equal(getKugouPlaybackBinding(original), null);
  assert.throws(() => setKugouPlaybackBinding(original, selected), /quota/);
});
