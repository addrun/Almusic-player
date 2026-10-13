import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { CacheManager, MusicParser } from '../src/renderer/api/musicParser';
import { rejectKugouPlaybackUrl } from '../src/renderer/api/kugouPlaybackFallback';
import type { GDCrossPlatformSearchItem } from '../src/renderer/api/gdmusic';
import type { SongResult } from '../src/renderer/types/music';
import {
  parserFixture as fixture,
  resetParserFixture
} from './helpers/kugou-playback-parser-fixture';

beforeEach(resetParserFixture);

function imported(id: string): SongResult {
  return {
    id: `kugou:${id}`,
    name: 'Color Your Night.mp3',
    ar: [{ name: 'Chewie Melodies / Pealeaf', id: 0 }],
    al: { name: 'Persona 3 Reload', id: 0 },
    duration: 159000,
    dt: 159000,
    count: 0,
    picUrl: '',
    platform: 'kugou',
    platformId: 'A'.repeat(32),
    kugou: { albumId: '12', albumAudioId: '34', unavailable: false }
  } as SongResult;
}

function canonical(id: number): SongResult {
  return {
    id,
    name: 'Color Your Night',
    ar: [
      { name: 'Chewie Melodies', id: 0 },
      { name: 'Pealeaf', id: 1 }
    ],
    al: { name: 'Persona 3 Reload', id: 0 },
    dt: 159000,
    count: 0,
    picUrl: ''
  } as SongResult;
}

function gdItem(
  id: string,
  urlId: string,
  artists = ['Chewie Melodies', 'Pealeaf']
): GDCrossPlatformSearchItem {
  return {
    id,
    url_id: urlId,
    name: 'Color Your Night',
    artist: artists,
    album: 'Persona 3 Reload',
    pic_id: '',
    lyric_id: '',
    source: 'netease'
  };
}

test('exact Kugou hash playback succeeds without invoking any search fallback', async () => {
  const song = imported('direct');
  fixture.directResult = { url: 'https://audio.example/kugou-direct.mp3', bitrate: 320000 };
  const result = await MusicParser.parseMusic(0, song);
  assert.equal(result.data.data?.url, fixture.directResult.url);
  assert.deepEqual(fixture.directCalls, [
    {
      channel: 'kugou:song-url',
      payload: { hash: song.platformId, albumId: '12', albumAudioId: '34', quality: '320' }
    }
  ]);
  assert.deepEqual(fixture.unblockCalls, []);
  assert.deepEqual(fixture.neteaseSearchCalls, []);
  assert.deepEqual(fixture.gdSearchCalls, []);
});

test('failed Kugou paths automatically resolve the canonical Netease numeric ID, retaining imported metadata', async () => {
  const song = imported('netease');
  const original = structuredClone(song);
  fixture.neteaseSongs = [canonical(123456)];
  fixture.neteaseAudio.set(123456, { url: 'https://audio.example/netease-full.mp3' });
  const result = await MusicParser.parseMusic(0, song);
  assert.equal(result.data.data?.url, 'https://audio.example/netease-full.mp3');
  assert.deepEqual(fixture.neteaseSearchCalls, [
    {
      keywords: 'Color Your Night Chewie Melodies Pealeaf',
      type: 1,
      limit: 20
    }
  ]);
  assert.deepEqual(fixture.neteaseUrlCalls, [123456]);
  assert.equal(fixture.unblockCalls[0].data.name, 'Color Your Night');
  assert.deepEqual(fixture.unblockCalls[0].sources, ['kugou']);
  assert.deepEqual(
    fixture.gdSearchCalls.map((call) => call.platform),
    ['joox', 'tidal', 'netease']
  );
  assert.deepEqual(fixture.gdUrlCalls, []);
  assert.deepEqual(fixture.requestMusicCalls, []);
  assert.deepEqual(song, original);
});

test('a Netease trial is rejected before selecting the next full matched track', async () => {
  fixture.neteaseSongs = [canonical(2001), canonical(2002)];
  fixture.neteaseAudio.set(2001, {
    url: 'https://audio.example/preview.mp3',
    freeTrialInfo: { start: 0, end: 30 }
  });
  fixture.neteaseAudio.set(2002, { url: 'https://audio.example/full-version.mp3' });
  const result = await MusicParser.parseMusic(0, imported('trial'));
  assert.equal(result.data.data?.url, 'https://audio.example/full-version.mp3');
  assert.deepEqual(fixture.neteaseUrlCalls, [2001, 2002]);
  assert.deepEqual(fixture.gdUrlCalls, []);
});

test('GD fallback uses the verified candidate url_id and excludes same-title covers', async () => {
  const song = imported('gd-match');
  const original = structuredClone(song);
  fixture.neteaseSongs = [canonical(3001)];
  fixture.gdItems.set('netease', [
    gdItem('cover-meta', 'cover-url-id', ['Another Singer']),
    { ...gdItem('live-meta', 'live-url-id'), name: 'Color Your Night (Live)' },
    gdItem('approved-meta-id', 'approved-url-id')
  ]);
  fixture.gdUrls.set('netease:approved-url-id', 'https://audio.example/gd-full.mp3');
  fixture.gdUrls.set('netease:cover-url-id', 'https://audio.example/wrong-cover.mp3');
  const result = await MusicParser.parseMusic(0, song);
  assert.equal(result.data.data?.url, 'https://audio.example/gd-full.mp3');
  assert.deepEqual(fixture.neteaseUrlCalls, [3001]);
  assert.deepEqual(fixture.gdUrlCalls, [
    { platform: 'netease', id: 'approved-url-id', quality: '999' }
  ]);
  assert.equal(fixture.gdSearchCalls[0].query, 'Color Your Night Chewie Melodies Pealeaf');
  assert.deepEqual(song, original);
});

test('Netease and GD source search exceptions still allow a later matched source', async () => {
  fixture.neteaseSearchError = true;
  fixture.gdSearchErrors.add('netease');
  fixture.gdItems.set('joox', [{ ...gdItem('joox-metadata-id', 'joox-url-id'), source: 'joox' }]);
  fixture.gdUrls.set('joox:joox-url-id', 'https://audio.example/joox-full.mp3');
  const result = await MusicParser.parseMusic(0, imported('source-errors'));
  assert.equal(result.data.data?.url, 'https://audio.example/joox-full.mp3');
  assert.deepEqual(
    fixture.gdSearchCalls.map((call) => call.platform),
    ['joox', 'tidal', 'netease']
  );
  assert.deepEqual(fixture.gdUrlCalls, [{ platform: 'joox', id: 'joox-url-id', quality: '999' }]);
});

test('disabled GD configuration preserves the existing JOOX fallback without adding GD catalogs', async () => {
  fixture.settings.setData.enabledMusicSources = [];
  fixture.gdItems.set('netease', [gdItem('disabled-meta', 'disabled-url')]);
  fixture.gdUrls.set('netease:disabled-url', 'https://audio.example/disabled.mp3');
  const result = await MusicParser.parseMusic(0, imported('gd-disabled'));
  assert.equal(result.data.code, 404);
  assert.deepEqual(
    fixture.gdSearchCalls.map((call) => call.platform),
    ['joox']
  );
  assert.deepEqual(fixture.gdUrlCalls, []);
});

test('global unblock disabled also prevents adding GD catalogs', async () => {
  fixture.settings.setData.enableMusicUnblock = false;
  fixture.gdItems.set('tidal', [gdItem('disabled-meta', 'disabled-url')]);
  fixture.gdUrls.set('tidal:disabled-url', 'https://audio.example/disabled.mp3');
  const result = await MusicParser.parseMusic(0, imported('unblock-disabled'));
  assert.equal(result.data.code, 404);
  assert.deepEqual(
    fixture.gdSearchCalls.map((call) => call.platform),
    ['joox']
  );
  assert.deepEqual(fixture.gdUrlCalls, []);
});

test('a pre-existing one-minute crossPlatform failure does not block newly playable imported fallback', async () => {
  const song = imported('failure-cache');
  const failCacheKey = Number(
    String(song.platformId)
      .split('')
      .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0)
  );
  CacheManager.addFailedCache(failCacheKey, 'crossPlatform');
  assert.equal(CacheManager.isInFailedCache(failCacheKey, 'crossPlatform'), true);
  fixture.neteaseSongs = [canonical(4001)];
  fixture.neteaseAudio.set(4001, { url: 'https://audio.example/newly-playable.mp3' });
  const result = await MusicParser.parseMusic(0, song);
  assert.equal(result.data.data?.url, 'https://audio.example/newly-playable.mp3');
  assert.deepEqual(fixture.neteaseUrlCalls, [4001]);
});

test('How Long uses the same 999 GD quality as its playable ordinary search result', async () => {
  const song = {
    ...imported('how-long-gd'),
    name: 'How Long.mp3',
    ar: [{ name: 'Charlie Puth', id: 0 }],
    duration: 188000,
    dt: 188000
  } as SongResult;
  fixture.neteaseSongs = [
    {
      ...canonical(5001),
      name: 'How Long',
      ar: [{ name: 'Charlie Puth', id: 0 }],
      dt: 188000
    } as SongResult
  ];
  fixture.gdItems.set('joox', [
    {
      ...gdItem('wrong-artist', 'wrong-artist-url', ['Tribute Band']),
      name: 'How Long',
      source: 'joox'
    },
    {
      ...gdItem('how-long-approved', 'how-long-url', ['Charlie Puth']),
      name: 'How Long',
      source: 'joox'
    }
  ]);
  fixture.gdQualityUrls.set('joox:how-long-url:999', 'https://audio.example/how-long-gd-full.mp3');
  // The current preference has no address on this provider, matching the regression.
  fixture.gdQualityUrls.set('joox:how-long-url:320', '');
  const result = await MusicParser.parseMusic(0, song);
  assert.equal(result.data.data?.url, 'https://audio.example/how-long-gd-full.mp3');
  assert.deepEqual(fixture.gdUrlCalls, [{ platform: 'joox', id: 'how-long-url', quality: '999' }]);
  assert.equal(fixture.gdSearchCalls[0].query, 'How Long Charlie Puth');
});

test('GD falls back to the requested lower quality for the same verified ID', async () => {
  fixture.gdItems.set('joox', [{ ...gdItem('quality-meta', 'quality-id'), source: 'joox' }]);
  fixture.gdQualityUrls.set('joox:quality-id:999', '');
  fixture.gdQualityUrls.set('joox:quality-id:320', 'https://audio.example/quality-fallback.mp3');
  const result = await MusicParser.parseMusic(0, imported('quality-fallback'));
  assert.equal(result.data.data?.url, 'https://audio.example/quality-fallback.mp3');
  assert.deepEqual(fixture.gdUrlCalls, [
    { platform: 'joox', id: 'quality-id', quality: '999' },
    { platform: 'joox', id: 'quality-id', quality: '320' }
  ]);
});

test('GD resolves the result declared source when it is enabled, and rejects a disabled catalog', async () => {
  fixture.gdItems.set('joox', [{ ...gdItem('redirected-meta', 'redirected-id'), source: 'tidal' }]);
  fixture.gdUrls.set('tidal:redirected-id', 'https://audio.example/declared-catalog.mp3');
  const result = await MusicParser.parseMusic(0, imported('declared-source-enabled'));
  assert.equal(result.data.data?.url, 'https://audio.example/declared-catalog.mp3');
  assert.deepEqual(fixture.gdUrlCalls, [
    { platform: 'tidal', id: 'redirected-id', quality: '999' }
  ]);

  resetParserFixture();
  fixture.settings.setData.enabledMusicSources = [];
  fixture.gdItems.set('joox', [{ ...gdItem('disabled-meta', 'disabled-id'), source: 'tidal' }]);
  fixture.gdUrls.set('tidal:disabled-id', 'https://audio.example/disabled-catalog.mp3');
  const disabled = await MusicParser.parseMusic(0, imported('declared-source-disabled'));
  assert.equal(disabled.data.code, 404);
  assert.deepEqual(fixture.gdUrlCalls, []);
});

test('a user-bound version resolves through the ordinary playback hook before the original hash', async () => {
  const song = imported('bound-version');
  const bound = canonical(6001);
  fixture.binding = bound;
  fixture.boundUrl = 'https://audio.example/user-selected.mp3';
  fixture.directResult = { url: 'https://audio.example/original.mp3', bitrate: 320000 };
  const result = await MusicParser.parseMusic(0, song);
  assert.equal(result.data.data?.url, fixture.boundUrl);
  assert.deepEqual(fixture.boundCalls, [{ id: 6001, song: bound, isDownloaded: false }]);
  assert.deepEqual(fixture.directCalls, []);
  assert.deepEqual(fixture.neteaseSearchCalls, []);
  assert.deepEqual(fixture.gdSearchCalls, []);
});

test('a failed or rejected bound version returns failure instead of silently changing recordings', async () => {
  for (const mode of ['missing', 'error', 'rejected']) {
    resetParserFixture();
    const song = imported(`bound-failure-${mode}`);
    fixture.binding = canonical(6002);
    if (mode === 'error') fixture.boundError = true;
    if (mode === 'rejected') {
      fixture.boundUrl = 'https://audio.example/rejected-bound.mp3';
      rejectKugouPlaybackUrl(song, fixture.boundUrl);
    }
    fixture.directResult = { url: 'https://audio.example/original.mp3', bitrate: 320000 };
    const result = await MusicParser.parseMusic(0, song);
    assert.equal(result.data.code, 404);
    assert.deepEqual(fixture.directCalls, []);
    assert.deepEqual(fixture.neteaseSearchCalls, []);
    assert.deepEqual(fixture.gdSearchCalls, []);
  }
});
