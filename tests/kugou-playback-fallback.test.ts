import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isRejectedKugouPlaybackUrl,
  rejectKugouPlaybackUrl,
  resolveKugouPlaybackFallback
} from '../src/renderer/api/kugouPlaybackFallback';
import type { MusicParseResult } from '../src/renderer/api/musicParser';
import type { SongResult } from '../src/renderer/types/music';

function imported(id: string, overrides: Partial<SongResult> = {}): SongResult {
  return {
    id: `kugou:${id}`,
    name: 'Color Your Night.mp3',
    ar: [{ name: 'Chewie Melodies / Pealeaf', id: 0 }],
    al: { name: 'Persona 3 Reload', id: 0 },
    picUrl: '',
    count: 0,
    platform: 'kugou',
    platformId: 'A'.repeat(32),
    duration: 159000,
    dt: 159000,
    kugou: { albumId: '123', albumAudioId: '456', unavailable: false },
    ...overrides
  } as SongResult;
}

function candidate(id: string, overrides: Partial<SongResult> = {}): SongResult {
  return {
    id,
    name: 'Color Your Night',
    ar: [
      { name: 'Chewie Melodies', id: 0 },
      { name: 'Pealeaf', id: 1 }
    ],
    al: { name: 'Persona 3 Reload', id: 0 },
    picUrl: '',
    count: 0,
    platform: 'netease',
    platformId: id,
    dt: 159000,
    ...overrides
  } as SongResult;
}

function parsed(url: string): MusicParseResult {
  return { data: { code: 200, message: 'success', data: { url } } };
}

function freezeDeep(value: object): void {
  for (const entry of Object.values(value)) {
    if (entry && typeof entry === 'object') freezeDeep(entry);
  }
  Object.freeze(value);
}

test('fallback cleans the screenshot filename query and preserves frozen original playlist metadata', async () => {
  const song = imported('preserved');
  const original = structuredClone(song);
  freezeDeep(song);
  let searchedQuery = '';
  let resolvedId: string | number | undefined;
  const expected = parsed('https://audio.example/canonical.mp3');
  const result = await resolveKugouPlaybackFallback(song, [
    {
      name: 'netease',
      search: async (query) => {
        searchedQuery = query;
        return [candidate('canonical')];
      },
      resolve: async (song) => {
        resolvedId = song.id;
        return expected;
      }
    }
  ]);
  assert.equal(searchedQuery, 'Color Your Night Chewie Melodies Pealeaf');
  assert.equal(resolvedId, 'canonical');
  assert.equal(result, expected);
  assert.deepEqual(song, original);
});

test('no verified match means no playback URL request, including same-title covers', async () => {
  const resolved: Array<string | number> = [];
  const result = await resolveKugouPlaybackFallback(imported('no-match'), [
    {
      name: 'netease',
      search: async () => [
        candidate('cover', { ar: [{ name: 'Another Singer', id: 99 }] as SongResult['ar'] }),
        candidate('different-title', { name: 'Another Song' }),
        candidate('live', { name: 'Color Your Night (Live)' }),
        candidate('short-cut', { dt: 90000 })
      ],
      resolve: async (song) => {
        resolved.push(song.id);
        return parsed('https://audio.example/incorrect.mp3');
      }
    }
  ]);
  assert.equal(result, null);
  assert.deepEqual(resolved, []);
});

test('an unavailable first candidate continues to the next verified candidate', async () => {
  const resolved: Array<string | number> = [];
  const expected = parsed('https://audio.example/second.mp3');
  const result = await resolveKugouPlaybackFallback(imported('next-candidate'), [
    {
      name: 'netease',
      search: async () => [candidate('restricted'), candidate('playable')],
      resolve: async (song) => {
        resolved.push(song.id);
        return song.id === 'restricted' ? null : expected;
      }
    }
  ]);
  assert.deepEqual(resolved, ['restricted', 'playable']);
  assert.equal(result, expected);
});

test('empty playback addresses continue to the next candidate', async () => {
  const expected = parsed('https://audio.example/nonempty.mp3');
  const result = await resolveKugouPlaybackFallback(imported('empty-url'), [
    {
      name: 'netease',
      search: async () => [candidate('empty'), candidate('nonempty')],
      resolve: async (song) => (song.id === 'empty' ? parsed('') : expected)
    }
  ]);
  assert.equal(result, expected);
});

test('search and resolution failures do not stop later sources', async () => {
  const events: string[] = [];
  const expected = parsed('https://audio.example/final-source.mp3');
  const result = await resolveKugouPlaybackFallback(imported('provider-failures'), [
    {
      name: 'search-fails',
      search: async () => {
        events.push('search-fails');
        throw new Error('provider search unavailable');
      },
      resolve: async () => {
        throw new Error('must not be called');
      }
    },
    {
      name: 'resolve-fails',
      search: async () => {
        events.push('search-second');
        return [candidate('second')];
      },
      resolve: async () => {
        events.push('resolve-fails');
        throw new Error('provider parse unavailable');
      }
    },
    {
      name: 'final-source',
      search: async () => {
        events.push('search-final');
        return [candidate('final')];
      },
      resolve: async () => {
        events.push('resolve-final');
        return expected;
      }
    }
  ]);
  assert.equal(result, expected);
  assert.deepEqual(events, [
    'search-fails',
    'search-second',
    'search-final',
    'resolve-fails',
    'resolve-final'
  ]);
});

test('a rejected audio URL is skipped, and rejection is scoped to the original imported song', async () => {
  const song = imported('rejected-url');
  const rejectedUrl = 'https://audio.example/rejected.mp3';
  rejectKugouPlaybackUrl(song, rejectedUrl);
  assert.equal(isRejectedKugouPlaybackUrl(song, rejectedUrl), true);
  assert.equal(isRejectedKugouPlaybackUrl(imported('another-song'), rejectedUrl), false);
  const expected = parsed('https://audio.example/replacement.mp3');
  const resolved: Array<string | number> = [];
  const result = await resolveKugouPlaybackFallback(song, [
    {
      name: 'netease',
      search: async () => [candidate('rejected'), candidate('replacement')],
      resolve: async (song) => {
        resolved.push(song.id);
        return song.id === 'rejected' ? parsed(rejectedUrl) : expected;
      }
    }
  ]);
  assert.deepEqual(resolved, ['rejected', 'replacement']);
  assert.equal(result, expected);
});

test('unknown singers never substitute a title-only match', async () => {
  let resolved = 0;
  const song = imported('unknown-artist', {
    ar: [{ name: '未知歌手', id: 0 }] as SongResult['ar']
  });
  const result = await resolveKugouPlaybackFallback(song, [
    {
      name: 'netease',
      search: async (query) => {
        assert.equal(query, 'Color Your Night');
        return [candidate('known-singer')];
      },
      resolve: async () => {
        resolved++;
        return parsed('https://audio.example/unknown.mp3');
      }
    }
  ]);
  assert.equal(result, null);
  assert.equal(resolved, 0);
});

test('missing title never performs an artist-only source search', async () => {
  let searches = 0;
  const result = await resolveKugouPlaybackFallback(imported('empty-title', { name: '' }), [
    {
      name: 'netease',
      search: async () => {
        searches++;
        return [candidate('should-not-be-found')];
      },
      resolve: async () => parsed('https://audio.example/should-not-play.mp3')
    }
  ]);
  assert.equal(result, null);
  assert.equal(searches, 0);
});

test('a stalled first catalog cannot spend the whole shared budget before other catalogs search', async () => {
  const expected = parsed('https://audio.example/fast-later-source.mp3');
  const result = await resolveKugouPlaybackFallback(
    imported('parallel-search-budget'),
    [
      {
        name: 'stalled-search',
        search: () => new Promise(() => {}),
        resolve: async () => {
          throw new Error('No candidate should exist');
        }
      },
      {
        name: 'working-later-catalog',
        search: async () => [candidate('parallel-search-found')],
        resolve: async () => expected
      }
    ],
    100
  );
  assert.equal(result, expected);
});

test('a stalled candidate does not prevent a later catalog from resolving its full recording', async () => {
  const resolved: Array<string | number> = [];
  const expected = parsed('https://audio.example/parallel-resolution.mp3');
  const result = await resolveKugouPlaybackFallback(
    imported('parallel-resolve-budget'),
    [
      {
        name: 'stalled-candidates',
        search: async () => [candidate('hung-first'), candidate('must-not-start-after-win')],
        resolve: (song) => {
          resolved.push(song.id);
          return new Promise(() => {});
        }
      },
      {
        name: 'working-later-catalog',
        search: async () => [candidate('parallel-resolution-found')],
        resolve: async () => expected
      }
    ],
    100
  );
  assert.equal(result, expected);
  assert.deepEqual(resolved, ['hung-first']);
});

test('trial-marked candidate URLs are rejected in every fallback catalog', async () => {
  const expected = parsed('https://audio.example/full-after-preview.mp3');
  const result = await resolveKugouPlaybackFallback(imported('all-source-preview'), [
    {
      name: 'preview-capable-provider',
      search: async () => [candidate('preview'), candidate('full')],
      resolve: async (song) =>
        song.id === 'preview'
          ? {
              data: {
                code: 200,
                message: 'preview',
                data: {
                  url: 'https://audio.example/preview.mp3',
                  freeTrialInfo: { start: 0, end: 30 }
                }
              }
            }
          : expected
    }
  ]);
  assert.equal(result, expected);
});

test('an entirely stalled fallback stops at the shared deadline and an empty source list returns null', async () => {
  assert.equal(await resolveKugouPlaybackFallback(imported('empty-sources'), []), null);
  const result = await resolveKugouPlaybackFallback(
    imported('whole-budget-timeout'),
    [
      {
        name: 'hung-provider',
        search: () => new Promise(() => {}),
        resolve: async () => null
      }
    ],
    20
  );
  assert.equal(result, null);
});
