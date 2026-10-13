import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';

import { useFavoriteSongs } from '../src/renderer/hooks/useFavoriteSongs';
import { useSongItem } from '../src/renderer/hooks/useSongItem';
import { useFavoriteStore } from '../src/renderer/store/modules/favorite';
import type { Artist, SongResult } from '../src/renderer/types/music';
import {
  cleanLocalFavoriteSong,
  restoreLocalFavoriteSongs
} from '../src/renderer/utils/localFavoriteSongs';
import {
  type FavoriteSongId,
  type FavoriteSongInput,
  toggleSongFavorite
} from '../src/renderer/utils/songFavorite';
import { accountWrites, rendererPlayer } from './helpers/local-favorites-fixture';

let savedValues: Map<string, string>;

beforeEach(() => {
  setActivePinia(createPinia());
  savedValues = new Map();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => savedValues.get(key) ?? null,
      setItem: (key: string, value: string) => savedValues.set(key, value)
    }
  });
  accountWrites.length = 0;
  rendererPlayer.playMusic = {} as SongResult;
});

function track(id: string | number, platform = 'qq'): SongResult {
  return cleanLocalFavoriteSong({
    id,
    platform,
    name: `歌曲 ${id}`,
    platformId: `${id}`.replace(`${platform}:`, ''),
    ar: [{ name: '测试歌手', id: 0 } as Artist],
    duration: 180000,
    dt: 180000
  })!;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('QQ and Kugou favorites retain clean playback metadata through reload, without account writes', async () => {
  const favorites = useFavoriteStore();
  const hash = 'A'.repeat(32);
  const dirtySong = {
    ...track(`kugou:${hash}`, 'kugou'),
    platformId: hash,
    picUrl: 'https://cover.example/album.jpg?token=PRIVATE_QUERY#PRIVATE_HASH',
    playMusicUrl: 'https://audio.example/song?token=PRIVATE_AUDIO',
    lyric: { private: 'PRIVATE_LYRIC' },
    cookie: 'PRIVATE_COOKIE',
    account: { id: 'PRIVATE_ACCOUNT' },
    token: 'PRIVATE_TOKEN',
    kugou: { albumId: '123', albumAudioId: '456', unavailable: false, token: 'PRIVATE_KG' },
    ar: [{ name: '测试歌手', id: 0, token: 'PRIVATE_ARTIST' }],
    al: { name: '测试专辑', id: 0, songs: [{ token: 'PRIVATE_ALBUM' }] }
  } as unknown as FavoriteSongInput;
  await toggleSongFavorite(dirtySong, favorites);
  await toggleSongFavorite(track('qq:MID123'), favorites);
  assert.deepEqual(favorites.favoriteList, [`kugou:${hash}`, 'qq:MID123']);
  assert.deepEqual(accountWrites, []);
  const serialized = savedValues.get('localFavoriteSongs')!;
  assert.ok(!serialized.includes('PRIVATE_'));
  assert.ok(!serialized.includes('playMusicUrl'));
  assert.ok(!serialized.includes('lyric'));
  assert.equal(favorites.localFavoriteSongs[`kugou:${hash}`].platformId, hash);
  assert.equal(favorites.localFavoriteSongs[`kugou:${hash}`].al.name, '测试专辑');
  assert.equal(
    favorites.localFavoriteSongs[`kugou:${hash}`].picUrl,
    'https://cover.example/album.jpg'
  );
  assert.deepEqual(favorites.localFavoriteSongs[`kugou:${hash}`].kugou, {
    albumId: '123',
    albumAudioId: '456',
    unavailable: false
  });

  setActivePinia(createPinia());
  const restored = useFavoriteStore();
  assert.equal(restored.isFavorite('qq:MID123'), true);
  assert.equal(restored.localFavoriteSongs['qq:MID123'].duration, 180000);
  await toggleSongFavorite(restored.localFavoriteSongs['qq:MID123'], restored);
  assert.equal(restored.isFavorite('qq:MID123'), false);
  assert.equal(Object.hasOwn(restored.localFavoriteSongs, 'qq:MID123'), false);
  assert.equal(
    Object.hasOwn(JSON.parse(savedValues.get('localFavoriteSongs')!), 'qq:MID123'),
    false
  );
  assert.deepEqual(accountWrites, []);
});

test('numeric NetEase favorites keep their existing account behavior and store no new snapshots', async () => {
  const favorites = useFavoriteStore();
  await toggleSongFavorite({ id: '123', platform: 'netease', name: '网易云曲' }, favorites);
  assert.deepEqual(favorites.favoriteList, [123]);
  assert.deepEqual(favorites.localFavoriteSongs, {});
  assert.deepEqual(accountWrites, [{ id: 123, like: true }]);
  await toggleSongFavorite({ id: 123 }, favorites);
  assert.deepEqual(accountWrites, [
    { id: 123, like: true },
    { id: 123, like: false }
  ]);
});

test('song-row actions use complete string identities, can play saved tracks, and remove metadata', async () => {
  const item = reactive(track('qq:ROW123'));
  const actions = useSongItem({ item });
  let stopped = 0;
  const event = { stopPropagation: () => stopped++ } as unknown as Event;
  assert.equal(actions.isFavorite.value, false);
  await actions.toggleFavorite(event);
  assert.equal(actions.isFavorite.value, true);
  const favorites = useFavoriteStore();
  assert.equal(favorites.localFavoriteSongs['qq:ROW123'].platformId, 'ROW123');
  assert.equal(await actions.playMusicEvent(favorites.localFavoriteSongs['qq:ROW123']), true);
  assert.equal(rendererPlayer.playMusic.id, 'qq:ROW123');
  await actions.toggleFavorite(event);
  assert.equal(actions.isFavorite.value, false);
  assert.deepEqual(favorites.localFavoriteSongs, {});
  assert.equal(stopped, 2);
  assert.deepEqual(accountWrites, []);
});

test('snapshot hydration rejects orphaned/mismatched/unsupported rows and strips unknown nested data', () => {
  const valid = track('qq:A');
  assert.deepEqual(restoreLocalFavoriteSongs(null, ['qq:A']), {});
  assert.deepEqual(restoreLocalFavoriteSongs([], ['qq:A']), {});
  const restored = restoreLocalFavoriteSongs(
    {
      'qq:A': { ...valid, playMusicUrl: 'SECRET', account: 'SECRET' },
      'qq:B': { ...valid, id: 'qq:B' },
      'qq:C': { ...valid, id: 'qq:A' },
      'qq:D': null
    },
    ['qq:A', 'qq:C', 'qq:D']
  );
  assert.deepEqual(Object.keys(restored), ['qq:A']);
  assert.ok(!JSON.stringify(restored).includes('SECRET'));
  assert.equal(cleanLocalFavoriteSong({ id: 123, platform: 'netease' }), null);
  assert.equal(cleanLocalFavoriteSong({ id: 'local-file', name: '本地曲' }), null);
  assert.equal(
    cleanLocalFavoriteSong({ id: 'qq:X', platform: 'qq', platformId: 'https://secret.example' }),
    null
  );
  assert.equal(
    cleanLocalFavoriteSong({ ...valid, picUrl: 'https://user:secret@cover.example/a.jpg' })?.picUrl,
    ''
  );
  assert.equal(cleanLocalFavoriteSong({ ...valid, id: 'https://example/song?token=secret' }), null);
  const fallback = cleanLocalFavoriteSong({ ...valid, ar: [], artists: valid.ar });
  assert.equal(fallback?.ar[0].name, '测试歌手');
});

test('mixed favorites display and play in favorite-ID order, with true string selection identities', async () => {
  const favorites = useFavoriteStore();
  await favorites.addToFavorite(10);
  await toggleSongFavorite(track('qq:A'), favorites);
  await favorites.addToFavorite(20);
  await toggleSongFavorite(track('kugou:B', 'kugou'), favorites);
  let descending = false;
  const requested: number[][] = [];
  const pager = useFavoriteSongs({
    favoriteIds: () => favorites.favoriteList,
    localSongs: () => favorites.localFavoriteSongs,
    descending: () => descending,
    loadNeteaseSongs: async (ids) => {
      requested.push(ids);
      return [...ids].reverse().map((id) => ({ id, name: `网易云 ${id}` }) as SongResult);
    }
  });
  await pager.reload();
  assert.deepEqual(requested, [[10, 20]]);
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    [10, 'qq:A', 20, 'kugou:B']
  );
  assert.equal(pager.noMore.value, true);
  descending = true;
  await pager.reload();
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    ['kugou:B', 20, 'qq:A', 10]
  );
  const selected: FavoriteSongId[] = ['qq:A', 'kugou:B'];
  assert.deepEqual(
    pager.favoriteSongs.value
      .filter((song) => selected.includes(song.id))
      .map((song) => song.platform),
    ['kugou', 'qq']
  );
  pager.dispose();
});

test('all-local pages never request NetEase details; missing IDs are consumed rather than causing endless paging', async () => {
  const ids: FavoriteSongId[] = ['qq:A', 'qq:missing', 'qq:B'];
  const songs = { 'qq:A': track('qq:A'), 'qq:B': track('qq:B') };
  const pager = useFavoriteSongs({
    favoriteIds: () => ids,
    localSongs: () => songs,
    descending: () => false,
    pageSize: 2,
    loadNeteaseSongs: async () => {
      throw new Error('Must not call the NetEase API');
    }
  });
  await pager.reload();
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    ['qq:A']
  );
  assert.equal(pager.noMore.value, false);
  await pager.loadNextPage();
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    ['qq:A', 'qq:B']
  );
  assert.equal(pager.noMore.value, true);
  await pager.loadNextPage();
  assert.equal(pager.favoriteSongs.value.length, 2);
  pager.dispose();
});

test('a completely missing first page is skipped so later cross-platform favorites remain reachable', async () => {
  const pager = useFavoriteSongs({
    favoriteIds: () => ['qq:missing1', 'qq:missing2', 'qq:visible'],
    localSongs: () => ({ 'qq:visible': track('qq:visible') }),
    descending: () => false,
    pageSize: 2,
    loadNeteaseSongs: async () => []
  });
  await pager.reload();
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    ['qq:visible']
  );
  assert.equal(pager.noMore.value, true);
  pager.dispose();
});

test('an old detail response cannot overwrite new sort/reload results or reset the newer loading flag', async () => {
  const old = deferred<SongResult[]>();
  const fresh = deferred<SongResult[]>();
  let descending = false;
  let calls = 0;
  const pager = useFavoriteSongs({
    favoriteIds: () => [1, 2],
    localSongs: () => ({}),
    descending: () => descending,
    loadNeteaseSongs: () => (++calls === 1 ? old.promise : fresh.promise)
  });
  const oldRead = pager.reload();
  descending = true;
  const newRead = pager.reload();
  old.resolve([{ id: 1 } as SongResult, { id: 2 } as SongResult]);
  await oldRead;
  assert.deepEqual(pager.favoriteSongs.value, []);
  assert.equal(pager.loading.value, true);
  fresh.resolve([{ id: 1 } as SongResult, { id: 2 } as SongResult]);
  await newRead;
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    [2, 1]
  );
  assert.equal(pager.loading.value, false);
  pager.dispose();
});

test('deleting during a pending read prevents the removed track from returning; unmount ignores later errors', async () => {
  const pending = deferred<SongResult[]>();
  const ids: FavoriteSongId[] = [1, 'qq:A'];
  const pager = useFavoriteSongs({
    favoriteIds: () => ids,
    localSongs: () => ({ 'qq:A': track('qq:A') }),
    descending: () => false,
    loadNeteaseSongs: () => pending.promise
  });
  const oldRead = pager.reload();
  ids.splice(0, 1);
  await pager.reload();
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    ['qq:A']
  );
  pending.resolve([{ id: 1 } as SongResult]);
  await oldRead;
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    ['qq:A']
  );
  pager.dispose();

  const errorRead = deferred<SongResult[]>();
  const closed = useFavoriteSongs({
    favoriteIds: () => [1],
    localSongs: () => ({}),
    descending: () => false,
    loadNeteaseSongs: () => errorRead.promise
  });
  const read = closed.reload();
  closed.dispose();
  errorRead.reject(new Error('PRIVATE_NETWORK_BODY'));
  await read;
  assert.deepEqual(closed.favoriteSongs.value, []);
  assert.equal(closed.loadError.value, '');
});

test('a NetEase request failure keeps local favorites visible and exposes a safe retry hint', async () => {
  let failed = true;
  const pager = useFavoriteSongs({
    favoriteIds: () => [1, 'qq:A'],
    localSongs: () => ({ 'qq:A': track('qq:A') }),
    descending: () => false,
    loadNeteaseSongs: async () => {
      if (failed) throw new Error('PRIVATE_RESPONSE');
      return [{ id: 1 } as SongResult];
    }
  });
  await pager.reload();
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    ['qq:A']
  );
  assert.equal(pager.noMore.value, true);
  assert.ok(pager.loadError.value.includes('重试'));
  assert.ok(!pager.loadError.value.includes('PRIVATE_'));
  failed = false;
  await pager.reload();
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    [1, 'qq:A']
  );
  assert.equal(pager.loadError.value, '');
  pager.dispose();
});

test('preview truncation preserves mixed favorite order and does not redefine end-of-IDs pagination', async () => {
  const ids = Array.from({ length: 5 }, (_, index) => `qq:${index}`);
  const pager = useFavoriteSongs({
    favoriteIds: () => ids,
    localSongs: () => Object.fromEntries(ids.map((id) => [id, track(id)])),
    descending: () => true,
    pageSize: 3,
    previewLimit: 2,
    loadNeteaseSongs: async () => []
  });
  await pager.reload();
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    ['qq:4', 'qq:3']
  );
  assert.equal(pager.noMore.value, false);
  await pager.loadNextPage();
  assert.equal(pager.favoriteSongs.value.length, 2);
  pager.dispose();
});

test('concurrent next-page triggers share loading ownership and never append a duplicate page', async () => {
  const pending = deferred<SongResult[]>();
  let calls = 0;
  const pager = useFavoriteSongs({
    favoriteIds: () => [1, 2],
    localSongs: () => ({}),
    descending: () => false,
    pageSize: 1,
    loadNeteaseSongs: async (ids) => {
      calls++;
      return ids[0] === 1 ? [{ id: 1 } as SongResult] : pending.promise;
    }
  });
  await pager.reload();
  const next = pager.loadNextPage();
  await pager.loadNextPage();
  assert.equal(calls, 2);
  pending.resolve([{ id: 2 } as SongResult]);
  await next;
  assert.deepEqual(
    pager.favoriteSongs.value.map((song) => song.id),
    [1, 2]
  );
  assert.equal(pager.noMore.value, true);
  pager.dispose();
});
