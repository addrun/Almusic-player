import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { paginateKugou } from '../src/main/kugou/pagination';
import { KugouClient, normalizeTrack, playlistPage } from '../src/main/kugou/protocol';
import { KugouService } from '../src/main/kugou/service';
import { KugouStorage } from '../src/main/kugou/storage';
import type { KugouAccount, KugouCache } from '../src/main/kugou/storage';
import type { KugouPlaylist } from '../src/shared/kugou';

const directoryRows = Array.from({ length: 40 }, (_, index) => ({
  listid: index + 1,
  name: index === 0 ? '我喜欢' : `Fixture playlist ${index + 1}`,
  type: 0,
  count: 0
}));
const identity = (playlist: KugouPlaylist) => playlist.id;
const observedEmptyTail = { status: 1, error_code: 0, data: { info: null, total_ver: 981 } };

test('the observed successful null-info tail completes a later directory page without an error', async () => {
  const result = await paginateKugou({
    pageSize: 100,
    identity,
    fetchPage: async (page) => playlistPage(page === 1
      ? { status: 1, error_code: 0, data: { info: directoryRows, total_ver: 981 } }
      : observedEmptyTail, '123', page)
  });
  assert.equal(result.pages, 2);
  assert.equal(result.rows.length, 40);
  assert.equal(result.complete, true);
  assert.equal(result.nullInfoEnd, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.total, undefined, 'total_ver is a version, never a playlist count');
});

test('null-info compatibility never accepts a first page, missing fields or a failed response', () => {
  assert.throws(() => playlistPage(observedEmptyTail, '123'), /无法识别/);
  for (const body of [
    { ...observedEmptyTail, status: 0 },
    { ...observedEmptyTail, status: '1' },
    { ...observedEmptyTail, error_code: 1 },
    { ...observedEmptyTail, error_code: undefined },
    { ...observedEmptyTail, errcode: 3 },
    { ...observedEmptyTail, _errno: '0' },
    { ...observedEmptyTail, data: {} },
    { ...observedEmptyTail, data: null },
    { ...observedEmptyTail, data: { total_ver: 981 } },
    { ...observedEmptyTail, data: { info: null } },
    { ...observedEmptyTail, data: { info: null, total_ver: true } },
    { ...observedEmptyTail, data: { info: null, total_ver: -1 } },
    { ...observedEmptyTail, data: { info: null, total_ver: '981' } },
    { ...observedEmptyTail, data: { info: null, total_ver: 981, list: 'bad' } },
    { ...observedEmptyTail, data: { info: null, total_ver: 981, total: 0 } },
    { ...observedEmptyTail, data: { info: null, total_ver: 981, count: 0 } },
    { ...observedEmptyTail, data: { info: null, total_ver: 981, total_count: 0 } }
  ]) assert.throws(() => playlistPage(body, '123', 2), /无法识别/);
});

test('a successful null-info tail cannot hide a higher previously declared directory total', async () => {
  const result = await paginateKugou({
    pageSize: 100,
    identity,
    fetchPage: async (page) => playlistPage(page === 1
      ? { data: { info: directoryRows, total: 80 } }
      : observedEmptyTail, '123', page)
  });
  assert.equal(result.rows.length, 40);
  assert.equal(result.total, 80);
  assert.equal(result.complete, false);
  assert.match(result.warnings.join(' '), /80.*40/);
});

test('a reliable total of 40 completes the directory without requesting a second page', async () => {
  const pages: number[] = [];
  const result = await paginateKugou({
    pageSize: 100,
    identity,
    fetchPage: async (page) => {
      pages.push(page);
      return playlistPage({ data: { info: directoryRows, total: 40 } }, '123');
    }
  });
  assert.deepEqual(pages, [1]);
  assert.equal(result.rows.length, 40);
  assert.equal(result.complete, true);
});

test('an explicitly empty directory page confirms exhaustion when no total is provided', async () => {
  for (const emptyData of [[], { info: [] }, { lists: [] }, { list: [] }]) {
    const result = await paginateKugou({
      pageSize: 100,
      identity,
      fetchPage: async (page) => playlistPage({ data: page === 1 ? { info: directoryRows } : emptyData }, '123')
    });
    assert.equal(result.pages, 2);
    assert.equal(result.rows.length, 40);
    assert.equal(result.complete, true);
    assert.deepEqual(result.warnings, []);
  }
});

test('a second directory page with missing fields cannot be treated as successful exhaustion', async () => {
  for (const malformedData of [{}, null, { info: null }, { info: 'not-a-list' }, { total: 0 }]) {
    const result = await paginateKugou({
      pageSize: 100,
      identity,
      fetchPage: async (page) => playlistPage({ data: page === 1 ? { info: directoryRows } : malformedData }, '123')
    });
    assert.equal(result.rows.length, 40);
    assert.equal(result.complete, false);
    assert.equal(result.total, undefined);
    assert.match(result.warnings.join(' '), /第 2 页读取失败.*40.*无法识别/);
  }
});

test('an explicit empty page still cannot complete a directory whose total exceeds fetched rows', async () => {
  const result = await paginateKugou({
    pageSize: 100,
    identity,
    fetchPage: async (page) => playlistPage({ data: { info: page === 1 ? directoryRows : [], total: 80 } }, '123')
  });
  assert.equal(result.rows.length, 40);
  assert.equal(result.complete, false);
  assert.equal(result.total, 80);
  assert.match(result.warnings.join(' '), /80.*40/);
});

test('unrecognized directory diagnostics contain only schema labels and numeric status, never private values or keys', () => {
  const sentinel = 'confidential-catalogue-fixture';
  assert.throws(() => playlistPage({
    status: 1,
    error_code: '0',
    errcode: { message: sentinel },
    _errno: sentinel,
    [sentinel]: sentinel,
    token: sentinel,
    data: { info: null, total_ver: sentinel, token: sentinel, userid: sentinel, [sentinel]: sentinel }
  }, '123'), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /status=1；error_code=0；errcode=object；_errno=string/);
    assert.match(error.message, /data=object；目录字段=info:null,total_ver:string/);
    assert.equal(error.message.includes(sentinel), false);
    assert.equal(error.message.includes('token'), false);
    assert.equal(error.message.includes('userid'), false);
    return true;
  });
});

test('a malformed second catalogue page retains playlists and tracks missing from the new first page', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'zephyrus-catalogue-fixture-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const account: KugouAccount = {
    credentials: { userId: '123', token: 'isolated-fixture-token', device: { mid: '1234567890', dev: 'ABCDEF1234', dfid: '-' } },
    profile: { userId: '123', nickname: 'Isolated catalogue fixture' }
  };
  const oldPlaylist = playlistPage({ data: { info: [{ listid: 999, name: 'Cached fixture playlist', count: 1 }] } }, '123').rows[0];
  Object.assign(oldPlaylist, { complete: true, fetchedTrackCount: 1 });
  const oldTrack = normalizeTrack({ hash: 'a'.repeat(32), name: 'Cached fixture song' }, 0);
  const cache: KugouCache = {
    version: 1,
    userId: '123',
    library: { profile: account.profile, playlists: [oldPlaylist], complete: true, syncedAt: 1, warnings: [] },
    tracks: { [oldPlaylist.id]: { playlist: oldPlaylist, tracks: [oldTrack] } }
  };
  const storage = new KugouStorage(directory);
  storage.saveAccount(account);
  storage.saveCache(cache);
  const service = new KugouService(directory);
  context.after(() => service.dispose());
  const internal = service as unknown as { client: KugouClient };
  internal.client.destroy();
  const requestedDirectoryPages: unknown[] = [];
  internal.client = {
    device: account.credentials.device,
    destroy() {},
    request: async (request) => {
      if (request.path === '/v7/get_all_list') {
        requestedDirectoryPages.push(request.data?.page);
        return { data: request.data?.page === 1 ? { info: directoryRows } : {} };
      }
      if (String(request.data?.listid) === '999') throw new Error('Cached fixture playlist request unavailable');
      return { data: { songs: [], count: 0 } };
    }
  } as KugouClient;
  const result = await service.sync(() => undefined);
  assert.deepEqual(requestedDirectoryPages, [1, 2]);
  assert.equal(result.playlists.length, 41);
  assert.equal(result.complete, false);
  assert.match(result.warnings.join(' '), /第 2 页读取失败/);
  assert.equal(result.expectedPlaylistCount, undefined);
  assert.equal(result.playlists.find((playlist) => playlist.id === oldPlaylist.id)?.complete, false);
  assert.deepEqual((await service.playlistTracks(oldPlaylist.id)).tracks, JSON.parse(JSON.stringify([oldTrack])));
});

for (const missingCachedPlaylist of [false, true]) {
  test(`service accepts the successful null tail and ${missingCachedPlaylist ? 'retains a missing cached playlist with a warning' : 'completes when cached playlists were returned'}`, async (context) => {
    const directory = mkdtempSync(join(tmpdir(), 'zephyrus-null-tail-fixture-'));
    context.after(() => rmSync(directory, { recursive: true, force: true }));
    const account: KugouAccount = {
      credentials: { userId: '123', token: 'isolated-fixture-token', device: { mid: '1234567890', dev: 'ABCDEF1234', dfid: '-' } },
      profile: { userId: '123', nickname: 'Isolated catalogue fixture' }
    };
    const oldPlaylist = playlistPage({ data: { info: [{ listid: missingCachedPlaylist ? 999 : 1, name: missingCachedPlaylist ? 'Cached fixture playlist' : '我喜欢', count: 0 }] } }, '123').rows[0];
    Object.assign(oldPlaylist, { complete: true, fetchedTrackCount: 0 });
    const oldTrack = normalizeTrack({ hash: 'b'.repeat(32), name: 'Cached fixture song' }, 0);
    const cache: KugouCache = {
      version: 1, userId: '123',
      library: { profile: account.profile, playlists: [oldPlaylist], complete: true, syncedAt: 1, warnings: [] },
      tracks: { [oldPlaylist.id]: { playlist: oldPlaylist, tracks: missingCachedPlaylist ? [oldTrack] : [] } }
    };
    const storage = new KugouStorage(directory);
    storage.saveAccount(account);
    storage.saveCache(cache);
    const service = new KugouService(directory);
    context.after(() => service.dispose());
    const internal = service as unknown as { client: KugouClient };
    internal.client.destroy();
    const requestedPages: unknown[] = [];
    const requestedLists: string[] = [];
    internal.client = {
      device: account.credentials.device,
      destroy() {},
      request: async (request) => {
        if (request.path === '/v7/get_all_list') {
          requestedPages.push(request.data?.page);
          return request.data?.page === 1
            ? { status: 1, error_code: 0, data: { info: directoryRows, total_ver: 981 } }
            : observedEmptyTail;
        }
        requestedLists.push(String(request.data?.listid));
        return { data: { songs: [], count: 0 } };
      }
    } as KugouClient;
    const result = await service.sync(() => undefined);
    assert.deepEqual(requestedPages, [1, 2]);
    assert.equal(result.playlists.length, missingCachedPlaylist ? 41 : 40);
    assert.equal(result.complete, !missingCachedPlaylist);
    assert.equal(result.expectedPlaylistCount, undefined);
    assert.doesNotMatch(result.warnings.join(' '), /第 2 页读取失败|无法识别/);
    if (missingCachedPlaylist) {
      assert.equal(requestedLists.includes('999'), false, 'Missing cached playlist details are not fetched or replaced by empty success');
      assert.match(result.warnings.join(' '), /部分已缓存歌单.*已保留/);
      assert.deepEqual((await service.playlistTracks(oldPlaylist.id)).tracks, JSON.parse(JSON.stringify([oldTrack])));
    } else {
      assert.deepEqual(result.warnings, []);
    }
  });
}
