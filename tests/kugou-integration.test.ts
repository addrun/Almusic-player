import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { TestContext } from 'node:test';

import { app, ipcMain, safeStorage } from 'electron';

import { paginateKugou } from '../src/main/kugou/pagination';
import {
  KugouApiError,
  KugouClient,
  normalizeTrack,
  playlistPage,
  trackIdentity,
  trackPage
} from '../src/main/kugou/protocol';
import type { JsonObject, KugouPage } from '../src/main/kugou/protocol';
import { canPlayKugouTrack, toKugouSongResult } from '../src/renderer/api/kugou';
import { initializeKugou } from '../src/main/kugou';
import { KugouService, mergeTrackSources } from '../src/main/kugou/service';
import { KugouStorage } from '../src/main/kugou/storage';
import type { KugouAccount, KugouCache } from '../src/main/kugou/storage';

const confidentialFixtureToken = 'test-only-credential-that-must-not-cross-ipc';

function serviceFixture(context: TestContext, cacheWanted = true) {
  const directory = mkdtempSync(join(tmpdir(), 'zephyrus-kugou-tests-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const account: KugouAccount = {
    credentials: {
      userId: '123',
      token: confidentialFixtureToken,
      device: { mid: '1234567890', dev: 'ABCDEF1234', dfid: '-' }
    },
    profile: { userId: '123', nickname: 'Isolated test fixture' }
  };
  const track = normalizeTrack({ hash: 'a'.repeat(32), name: 'Fixture song' }, 0);
  const playlist = playlistPage({ data: { info: [{ listid: 1, global_collection_id: 'fixture-list', name: '我喜欢', type: 0, count: 1 }] } }, '123').rows[0];
  Object.assign(playlist, { complete: true, fetchedTrackCount: 1 });
  const cache: KugouCache = {
    version: 1,
    userId: '123',
    library: { profile: account.profile, playlists: [playlist], complete: true, syncedAt: 1, expectedPlaylistCount: 1, warnings: [] },
    tracks: { [playlist.id]: { playlist, tracks: [track] } }
  };
  const storage = new KugouStorage(directory);
  storage.saveAccount(account);
  if (cacheWanted) storage.saveCache(cache);
  const service = new KugouService(directory);
  context.after(() => service.dispose());
  return { directory, account, cache, service };
}

function replaceClient(service: KugouService, request: KugouClient['request']): void {
  const internal = service as unknown as { client: KugouClient };
  internal.client.destroy();
  internal.client = {
    device: { mid: '1234567890', dev: 'ABCDEF1234', dfid: '-' },
    request,
    destroy() {}
  } as KugouClient;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function numberedRows(length: number): Array<{ id: number }> {
  return Array.from({ length }, (_, id) => ({ id }));
}

test('a 751-song cloud list follows all three pages and preserves its order', async () => {
  const rows = numberedRows(751);
  const requests: number[] = [];
  const result = await paginateKugou({
    pageSize: 300,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async (page, size) => {
      requests.push(page);
      return { rows: rows.slice((page - 1) * size, page * size), total: rows.length };
    }
  });
  assert.deepEqual(requests, [1, 2, 3]);
  assert.deepEqual(result.rows, rows);
  assert.equal(result.complete, true);
  assert.deepEqual(result.warnings, []);
});

test('a short page without a total is followed by more pages until exhaustion', async () => {
  const batches = [numberedRows(103), numberedRows(100).map((row) => ({ id: row.id + 103 })), [{ id: 203 }], []];
  const result = await paginateKugou({
    pageSize: 300,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async (page) => ({ rows: batches[page - 1] })
  });
  assert.equal(result.rows.length, 204);
  assert.equal(result.pages, 4);
  assert.equal(result.complete, true);
});

test('stale catalogue counts do not prevent later track pages being read', async () => {
  const rows = numberedRows(631);
  const result = await paginateKugou({
    pageSize: 300,
    expectedTotal: 321,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async (page, size) => ({ rows: rows.slice((page - 1) * size, page * size) })
  });
  assert.equal(result.rows.length, 631);
  assert.equal(result.pages, 4);
  assert.equal(result.complete, true);
});

test('server page-size clamping still reads every item', async () => {
  const rows = numberedRows(321);
  const sizes: number[] = [];
  const result = await paginateKugou({
    pageSize: 300,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async (page, size) => {
      sizes.push(size);
      const actualSize = Math.min(size, 100);
      return { rows: rows.slice((page - 1) * actualSize, page * actualSize), total: 321, pageSize: 100 };
    }
  });
  assert.deepEqual(result.rows, rows);
  assert.deepEqual(sizes, [300, 100, 100, 100]);
  assert.equal(result.complete, true);
});

test('a repeated page stops requests and is reported as incomplete', async () => {
  let calls = 0;
  const result = await paginateKugou({
    pageSize: 100,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async () => { calls += 1; return { rows: numberedRows(100), total: 321 }; }
  });
  assert.equal(calls, 2);
  assert.equal(result.rows.length, 100);
  assert.equal(result.complete, false);
  assert.match(result.warnings.join(' '), /重复页/);
});

test('a reordered repeated page also stops without inflating counts', async () => {
  const rows = numberedRows(3);
  const result = await paginateKugou({
    pageSize: 3,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async (page) => ({ rows: page === 1 ? rows : [...rows].reverse(), total: 8 })
  });
  assert.deepEqual(result.rows, rows);
  assert.equal(result.pages, 2);
  assert.equal(result.complete, false);
  assert.match(result.warnings.join(' '), /没有新增/);
});

test('partial network failure retains songs and never reports full success', async () => {
  const result = await paginateKugou({
    pageSize: 300,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async (page) => {
      if (page === 2) throw new KugouApiError('连接超时。');
      return { rows: numberedRows(300), total: 751 };
    }
  });
  assert.equal(result.rows.length, 300);
  assert.equal(result.complete, false);
  assert.match(result.warnings.join(' '), /第 2 页读取失败/);
});

test('first-page failure rejects instead of replacing an existing list with empty success', async () => {
  await assert.rejects(paginateKugou({
    pageSize: 300,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async () => { throw new KugouApiError('接口失败。'); }
  }), /接口失败/);
});

test('a cloud playlist that explicitly contains zero songs is complete', async () => {
  const result = await paginateKugou({
    pageSize: 300,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async () => ({ rows: [], total: 0 })
  });
  assert.deepEqual(result.rows, []);
  assert.equal(result.complete, true);
  assert.equal(result.total, 0);
});

test('an early empty page with a higher declared count is incomplete', async () => {
  const result = await paginateKugou({
    pageSize: 300,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async (page) => ({ rows: page === 1 ? numberedRows(12) : [], total: 321 })
  });
  assert.equal(result.rows.length, 12);
  assert.equal(result.complete, false);
  assert.match(result.warnings.join(' '), /321.*12/);
});

test('more returned entries than the reported total are never labelled complete', async () => {
  const result = await paginateKugou({
    pageSize: 300,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async () => ({ rows: numberedRows(12), total: 10 })
  });
  assert.equal(result.rows.length, 12);
  assert.equal(result.complete, false);
  assert.match(result.warnings.join(' '), /10.*12/);
});

test('a count changed during reading prompts another refresh', async () => {
  const result = await paginateKugou({
    pageSize: 2,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async (page) => ({ rows: page === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }], total: page === 1 ? 4 : 3 })
  });
  assert.equal(result.rows.length, 3);
  assert.equal(result.complete, false);
  assert.match(result.warnings.join(' '), /数量发生变化/);
});

test('logout cancellation rejects a pending sync instead of exposing partial success', async () => {
  const controller = new AbortController();
  await assert.rejects(paginateKugou({
    pageSize: 300,
    signal: controller.signal,
    identity: (row: { id: number }) => String(row.id),
    fetchPage: async () => { controller.abort(); throw new Error('native error with confidential URL'); }
  }), /同步已取消/);
});

test('unexpected API shapes fail explicitly and do not look like an empty cloud library', () => {
  assert.throws(() => playlistPage({ data: {} }, '123'), /无法识别/);
  assert.throws(() => trackPage({ data: {} }), /无法识别/);
});

test('catalogue rows classify own, collected and liked playlists without returning login fields', () => {
  const result = playlistPage({
    data: { total: 3, info: [
      { listid: 1, name: '我喜欢', type: 0, count: 321, token: 'sentinel-secret' },
      { listid: 2, name: '我的歌单', type: 0, list_create_userid: 123 },
      { listid: 3, name: '收藏歌单', type: 1, list_create_userid: 456 }
    ] }
  }, '123');
  assert.deepEqual(result.rows.map((row) => row.category), ['liked', 'created', 'collected']);
  assert.equal(JSON.stringify(result).includes('sentinel-secret'), false);
  assert.equal(result.rows[0].trackCount, 321);
});

test('an imported song retains its exact hash and album identifiers through player conversion', () => {
  const hash = 'a'.repeat(32);
  const row: JsonObject = {
    hash,
    name: '歌手 - 歌曲名称',
    album_id: '1234',
    album_audio_id: '5678',
    albuminfo: { name: '专辑名称' },
    timelen: 180000,
    token: 'sentinel-secret',
    cover: 'http://imge.kugou.com/softhead/{size}/example.jpg'
  };
  const track = normalizeTrack(row, 0);
  const song = toKugouSongResult(track);
  assert.equal(track.name, '歌曲名称');
  assert.equal(track.artists[0].name, '歌手');
  assert.equal(song.platformId, hash.toUpperCase());
  assert.equal(song.platform, 'kugou');
  assert.equal(song.kugou?.albumId, '1234');
  assert.equal(song.kugou?.albumAudioId, '5678');
  assert.equal(song.dt, 180000);
  assert.match(song.picUrl, /^https:\/\/imge\.kugou\.com/);
  assert.equal(JSON.stringify(song).includes('sentinel-secret'), false);
  assert.equal(canPlayKugouTrack(track), true);
});

test('unavailable songs remain listed while the player marks them unavailable', () => {
  const track = normalizeTrack({ name: '已下架歌曲', fileid: 77 }, 0);
  const song = toKugouSongResult(track);
  assert.equal(track.name, '已下架歌曲');
  assert.equal(track.fileId, '77');
  assert.equal(canPlayKugouTrack(track), false);
  assert.equal(song.kugou?.unavailable, true);
});

test('pagination deduplication keeps different playable hashes distinct', async () => {
  const responses: KugouPage<JsonObject>[] = [
    { rows: [{ hash: 'a'.repeat(32) }, { hash: 'b'.repeat(32) }] },
    { rows: [{ hash: 'b'.repeat(32) }, { hash: 'c'.repeat(32) }] },
    { rows: [] }
  ];
  const result = await paginateKugou({
    pageSize: 2,
    identity: trackIdentity,
    fetchPage: async (page) => responses[page - 1]
  });
  assert.equal(result.rows.length, 3);
  assert.equal(result.complete, true);
});

test('public main-process status, library and track responses exclude the account token', async (context) => {
  const { service } = serviceFixture(context);
  assert.equal(service.status().loggedIn, true);
  const results = [service.status(), service.library(), await service.playlistTracks('0:1')];
  assert.equal(JSON.stringify(results).includes(confidentialFixtureToken), false);
  assert.equal(JSON.stringify(results).includes('credentials'), false);
});

test('a cache encrypted for another account is not loaded for the current account', (context) => {
  const { directory, cache, service } = serviceFixture(context);
  service.dispose();
  new KugouStorage(directory).saveCache({ ...cache, userId: '456' });
  const next = new KugouService(directory);
  context.after(() => next.dispose());
  assert.equal(next.status().loggedIn, true);
  assert.equal(next.library(), null);
});

test('no secure storage produces a clear ephemeral-only status', (context) => {
  const electronStorage = safeStorage as unknown as { enabled: boolean };
  electronStorage.enabled = false;
  context.after(() => { electronStorage.enabled = true; });
  const directory = mkdtempSync(join(tmpdir(), 'zephyrus-kugou-tests-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const service = new KugouService(directory);
  context.after(() => service.dispose());
  assert.equal(service.status().persistenceAvailable, false);
  assert.match(service.status().warning || '', /本次运行内存/);
});

test('IPC guards reject other windows, subframes, unexpected arguments and injected credential fields', async (context) => {
  const { directory } = serviceFixture(context);
  const fixtureApp = app as unknown as { testDirectory: string; emit: (name: string) => void };
  fixtureApp.testDirectory = directory;
  context.after(() => { fixtureApp.emit('before-quit'); fixtureApp.testDirectory = ''; });
  const frame = { url: 'file:///isolated-fixture/renderer/index.html#/kugou' };
  const window = {
    isDestroyed: () => false,
    webContents: { id: 7, mainFrame: frame, getURL: () => frame.url, send() {} }
  };
  initializeKugou(window as never, frame.url);
  const handlers = (ipcMain as unknown as { handlers: Map<string, (...args: unknown[]) => Promise<unknown>> }).handlers;
  const status = handlers.get('kugou:status')!;
  const event = { sender: { id: 7 }, senderFrame: frame };
  assert.equal(JSON.stringify(await status(event)).includes(confidentialFixtureToken), false);
  await assert.rejects(status({ ...event, sender: { id: 8 } }), /该窗口不能访问/);
  await assert.rejects(status({ ...event, senderFrame: { ...frame } }), /该窗口不能访问/);
  await assert.rejects(status(event, 'surprise'), /参数无效/);
  await assert.rejects(handlers.get('kugou:song-url')!(event, { hash: 'a'.repeat(32), token: 'injected-token' }), /请求参数无效/);
  frame.url = 'https://untrusted.example/index.html#/kugou';
  await assert.rejects(status(event), /请求来源无效/);
});

test('logout stops further quality attempts with the previous account credential', async (context) => {
  const { service } = serviceFixture(context);
  let calls = 0;
  replaceClient(service, async () => {
    calls += 1;
    if (calls === 1) service.logout();
    return { url: ['https://fs.kugou.com/fixture.mp3'] };
  });
  await assert.rejects(service.songUrl({ hash: 'a'.repeat(32), quality: 'flac' }), /账号已切换|取消/);
  assert.equal(calls, 1, 'Cancelled playback must not keep sending the former account token');
  assert.equal(service.status().loggedIn, false);
});

test('logout during one-playlist refresh stops any fallback request with previous credentials', async (context) => {
  const { service } = serviceFixture(context);
  let calls = 0;
  replaceClient(service, async (request) => {
    calls += 1;
    if (request.path.includes('get_list_all_file')) {
      service.logout();
      throw new KugouApiError('The pending connection ended');
    }
    return { data: { songs: [{ hash: 'a'.repeat(32) }], count: 1 } };
  });
  await assert.rejects(service.playlistTracks('0:1', true), /账号已切换|取消/);
  assert.equal(calls, 1, 'Cancelled refresh must not continue using a logged-out account');
  assert.equal(service.library(), null);
});

test('a refresh begun before full synchronization cannot overwrite a newer library snapshot', async (context) => {
  const { service } = serviceFixture(context);
  const previousResponse = deferred<JsonObject>();
  let trackCalls = 0;
  replaceClient(service, async (request) => {
    if (request.path === '/v7/get_all_list') {
      return { data: { info: [{ listid: 1, global_collection_id: 'fixture-list', name: '我喜欢', type: 0, count: 2 }], total: 1 } };
    }
    trackCalls += 1;
    if (trackCalls === 1) return previousResponse.promise;
    return { data: { songs: [{ hash: 'a'.repeat(32) }, { hash: 'b'.repeat(32) }], count: 2 } };
  });
  const refresh = service.playlistTracks('0:1', true).catch((error) => error);
  const synchronized = await service.sync(() => undefined);
  assert.equal(synchronized.playlists[0].fetchedTrackCount, 2);
  previousResponse.resolve({ data: { songs: [{ hash: 'a'.repeat(32) }], count: 1 } });
  await refresh;
  assert.equal(service.library()?.playlists[0].fetchedTrackCount, 2, 'The later full sync remains authoritative');
});

test('two partially read sources retain their distinct songs and remain incomplete', () => {
  const result = mergeTrackSources(
    { rows: [{ hash: 'a'.repeat(32) }], total: 3, complete: false, warnings: ['Cloud page 2 failed'], pages: 1 },
    { rows: [{ hash: 'b'.repeat(32) }, { hash: 'c'.repeat(32) }], total: 3, complete: false, warnings: ['Public page 2 failed'], pages: 1 }
  );
  assert.equal(result.rows.length, 3);
  assert.equal(result.complete, false, 'Matching a count alone cannot hide actual page failures');
  assert.equal(result.warnings.length >= 2, true);
});

test('a fallback source with fewer reported songs cannot hide the cloud count or its distinct songs', () => {
  const result = mergeTrackSources(
    { rows: [{ hash: 'a'.repeat(32) }, { hash: 'b'.repeat(32) }], total: 321, complete: false, warnings: ['Cloud page failed'], pages: 1 },
    { rows: [{ hash: 'c'.repeat(32) }], total: 1, complete: true, warnings: [], pages: 1 }
  );
  assert.equal(result.rows.length, 3);
  assert.equal(result.total, 321);
  assert.equal(result.complete, false);
  assert.match(result.warnings.join(' '), /321.*1/);
});

test('a public source can fill a cloud placeholder without losing album metadata', () => {
  const result = mergeTrackSources(
    { rows: [{ fileid: 12, name: 'Hidden song', album_id: '99', shield: 1 }], total: 1, complete: true, warnings: [], pages: 1 },
    { rows: [{ fileid: 12, hash: 'a'.repeat(32), name: 'Recovered song' }], total: 1, complete: true, warnings: [], pages: 1 }
  );
  assert.equal(result.rows.length, 1);
  const track = normalizeTrack(result.rows[0], 0);
  assert.equal(canPlayKugouTrack(track), true);
  assert.equal(track.albumId, '99');
});

test('partial refresh retains both new tracks and previously cached distinct tracks', async (context) => {
  const { service } = serviceFixture(context);
  replaceClient(service, async (request) => {
    const page = Number(request.data?.page || Number(request.params?.begin_idx || 0) / 100 + 1);
    if (page > 1) return { data: { songs: [], count: 3 } };
    return { data: { songs: [{ hash: 'b'.repeat(32) }], count: 3 } };
  });
  const result = await service.playlistTracks('0:1', true);
  assert.deepEqual(new Set(result.tracks.map((track) => track.hash)), new Set(['A'.repeat(32), 'B'.repeat(32)]));
  assert.equal(result.playlist.complete, false);
});

test('a complete refresh removes songs actually deleted from the cloud rather than resurrecting old cache', async (context) => {
  const { service } = serviceFixture(context);
  replaceClient(service, async () => ({ data: { songs: [{ hash: 'b'.repeat(32) }], count: 1 } }));
  const result = await service.playlistTracks('0:1', true);
  assert.deepEqual(result.tracks.map((track) => track.hash), ['B'.repeat(32)]);
  assert.equal(result.playlist.complete, true);
});

test('an absent file identifier represented as zero never collapses distinct hashes', async () => {
  const rows = [{ fileid: 0, hash: 'a'.repeat(32) }, { fileid: 0, hash: 'b'.repeat(32) }];
  const result = await paginateKugou({
    pageSize: 100,
    identity: trackIdentity,
    fetchPage: async (page) => ({ rows: page === 1 ? rows : [], total: 2 })
  });
  assert.equal(result.rows.length, 2);
  assert.equal(result.complete, true);
});

test('zero file identifiers do not collapse distinct hashes when cloud and public sources are merged', () => {
  const result = mergeTrackSources(
    { rows: [{ fileid: 0, hash: 'a'.repeat(32) }], total: 2, complete: false, warnings: [], pages: 1 },
    { rows: [{ fileid: 0, hash: 'b'.repeat(32) }], total: 2, complete: false, warnings: [], pages: 1 }
  );
  assert.equal(result.rows.length, 2);
});

test('signed-in audio requests keep tokens in the transport and return only the playable URL', async (context) => {
  const { service } = serviceFixture(context);
  let calls = 0;
  replaceClient(service, async (request) => {
    calls += 1;
    assert.equal(request.credentials?.token, confidentialFixtureToken);
    assert.equal(request.params?.IsFreePart, 0);
    assert.equal(typeof request.params?.key, 'string');
    return { data: { url: ['http://fs.kugou.com/fixture.mp3'], token: confidentialFixtureToken, bitrate: 320000 } };
  });
  const result = await service.songUrl({ hash: 'a'.repeat(32), albumId: '99', quality: '320' });
  assert.equal(result.url, 'https://fs.kugou.com/fixture.mp3');
  assert.equal(result.bitrate, 320000);
  assert.equal(JSON.stringify(result).includes(confidentialFixtureToken), false);
  await service.songUrl({ hash: 'a'.repeat(32), albumId: '99', quality: '320' });
  assert.equal(calls, 1, 'A recent URL is cached within the same account');
});

test('preview-only responses are rejected even when a seemingly playable URL is returned', async (context) => {
  const { service } = serviceFixture(context);
  replaceClient(service, async () => ({ data: { url: ['https://fs.kugou.com/preview.mp3'], is_free_part: 1 } }));
  await assert.rejects(service.songUrl({ hash: 'a'.repeat(32), quality: '128' }), /完整音频/);
});

test('unexpected hosts and URLs containing account credential query parameters cannot cross IPC', async (context) => {
  const { service } = serviceFixture(context);
  for (const url of ['https://untrusted.example/fixture.mp3', 'https://fs.kugou.com/fixture.mp3?token=secret']) {
    replaceClient(service, async () => ({ data: { url: [url] } }));
    await assert.rejects(service.songUrl({ hash: 'a'.repeat(32), quality: '128' }), /完整音频/);
  }
});

test('audio falls back to lower qualities when the account cannot obtain higher quality', async (context) => {
  const { service } = serviceFixture(context);
  const qualities: unknown[] = [];
  replaceClient(service, async (request) => {
    qualities.push(request.params?.quality);
    if (request.params?.quality === '128') return { data: { url: ['https://fs.kugou.com/fixture.mp3'] } };
    throw new KugouApiError('Higher quality unavailable');
  });
  const result = await service.songUrl({ hash: 'a'.repeat(32), quality: 'flac' });
  assert.equal(result.url, 'https://fs.kugou.com/fixture.mp3');
  assert.deepEqual(qualities, ['flac', '320', '128']);
});

test('an expired unknown QR session does not invent a logged-in account', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'zephyrus-kugou-tests-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const service = new KugouService(directory);
  context.after(() => service.dispose());
  assert.deepEqual(await service.checkLogin('0'.repeat(32)), { state: 'expired' });
  assert.equal(service.status().loggedIn, false);
  assert.equal(service.cancelLogin('0'.repeat(32)), false);
});

test('global song synchronization retains cached tracks on failure but never calls the result complete', async (context) => {
  const { service } = serviceFixture(context);
  replaceClient(service, async (request) => {
    if (request.path === '/v7/get_all_list') {
      return { data: { info: [{ listid: 1, global_collection_id: 'fixture-list', name: '我喜欢', type: 0, count: 3 }], total: 1 } };
    }
    throw new KugouApiError('Explicit test network failure');
  });
  const result = await service.sync(() => undefined);
  assert.equal(result.complete, false);
  assert.equal(result.playlists[0].complete, false);
  assert.equal(result.playlists[0].fetchedTrackCount, 1);
  assert.equal((await service.playlistTracks('0:1')).tracks[0].hash, 'A'.repeat(32));
});

test('a catalogue read failure rejects sync and preserves the last known complete library', async (context) => {
  const { service } = serviceFixture(context);
  replaceClient(service, async () => { throw new KugouApiError('Explicit catalogue failure'); });
  await assert.rejects(service.sync(() => undefined), /catalogue failure/);
  assert.equal(service.status().syncing, false);
  assert.equal(service.library()?.syncedAt, 1);
  assert.equal(service.library()?.playlists[0].fetchedTrackCount, 1);
});

test('destroying a Kugou client while its transport retries prevents requests with the old token', async () => {
  const client = new KugouClient({ mid: '1234567890', dev: 'ABCDEF1234', dfid: '-' });
  let calls = 0;
  const internal = client as unknown as { fetch: () => Promise<JsonObject> };
  internal.fetch = async () => {
    calls += 1;
    client.destroy();
    throw new KugouApiError('Retryable fixture error', undefined, true);
  };
  await assert.rejects(client.request({ path: '/v5/url', credentials: { userId: '123', token: confidentialFixtureToken, device: client.device } }));
  assert.equal(calls, 1, 'Destroy must prevent transport-level retries after logout or cancelled login');
});

test('playlist collecttime retains source-entry add time in milliseconds for numeric seconds and milliseconds', () => {
  const seconds = Date.UTC(2024, 4, 19, 8, 30, 0) / 1000;
  for (const value of [seconds, String(seconds), seconds * 1000, String(seconds * 1000)]) {
    assert.equal(normalizeTrack({ hash: 'a'.repeat(32), collecttime: value }, 0).addedAtMs, seconds * 1000);
  }
});

test('missing or corrupt collection timestamps remain unknown rather than looking like the oldest song', () => {
  for (const value of [undefined, null, '', ' ', 0, '0', true, false, -1, 20240519, 1234, 1.5, Infinity, '2024-05-19', Date.UTC(2100, 0, 1)]) {
    assert.equal(normalizeTrack({ hash: 'a'.repeat(32), collecttime: value }, 0).addedAtMs, undefined);
  }
  const noCollectionTime = normalizeTrack({
    hash: 'a'.repeat(32), publish_date: '2024-05-19', create_time: 1716107400,
    update_time: 1716107400, addtime: 1716107400, sort: 1716107400
  }, 0);
  assert.equal(noCollectionTime.addedAtMs, undefined, 'Publication date, list updates, order and unverified aliases are not collection time');
});

test('public popularity and unverified count fields never become this account\'s personal listening count', () => {
  const track = normalizeTrack({
    hash: 'a'.repeat(32), heat: 9000, count: 77, number: 1,
    playcount: 1000, play_count: 1000, playcnt: 1000, pc: 1000,
    personal_play_count: 1000
  }, 0);
  assert.equal(track.personalPlayCount, undefined);
  assert.equal(Object.hasOwn(track, 'personalPlayCount'), false);
  assert.equal(normalizeTrack({ hash: 'a'.repeat(32) }, 0).personalPlayCount, undefined);
});

test('repairing a hidden cloud song preserves account collection time and membership metadata over the public author\'s values', () => {
  const cloudTime = Date.UTC(2025, 5, 1) / 1000;
  const publicTime = Date.UTC(2023, 2, 1) / 1000;
  const merged = mergeTrackSources(
    { rows: [{ fileid: 42, shield: 1, collecttime: cloudTime, sort: 5, user_id: 123, album_id: '99' }], total: 1, complete: true, warnings: [], pages: 1 },
    { rows: [{ fileid: 42, hash: 'b'.repeat(32), name: 'Public playback details', collecttime: publicTime, sort: 91, user_id: 999 }], total: 1, complete: true, warnings: [], pages: 1 }
  );
  assert.equal(merged.rows.length, 1);
  assert.equal(merged.rows[0].collecttime, cloudTime);
  assert.equal(merged.rows[0].sort, 5);
  assert.equal(merged.rows[0].user_id, 123);
  const track = normalizeTrack(merged.rows[0], 0);
  assert.equal(track.addedAtMs, cloudTime * 1000);
  assert.equal(track.hash, 'B'.repeat(32));
  assert.equal(track.albumId, '99');
  assert.equal(track.unavailable, false);
});
