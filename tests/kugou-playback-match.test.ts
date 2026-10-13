import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildKugouPlaybackSearchQuery,
  getKugouPlaybackArtists,
  scoreKugouPlaybackCandidate,
  stripAudioFileExtension
} from '../src/renderer/utils/kugouPlaybackMatch';

test('Color Your Night filename matches the canonical duet and builds a clean search query', () => {
  const imported = {
    name: 'Color Your Night.mp3',
    ar: [{ name: 'Chewie Melodies / Pealeaf' }],
    dt: 159000
  };
  assert.deepEqual(getKugouPlaybackArtists(imported), ['Chewie Melodies', 'Pealeaf']);
  assert.equal(buildKugouPlaybackSearchQuery(imported), 'Color Your Night Chewie Melodies Pealeaf');
  assert.ok(
    scoreKugouPlaybackCandidate(imported, {
      name: 'Color Your Night',
      artists: [{ name: 'Chewie Melodies' }, { name: 'Pealeaf' }],
      durationMs: 160000
    }) > 0
  );
});

test('the playable HOYO-MiX example remains matchable with a filename suffix', () => {
  assert.ok(
    scoreKugouPlaybackCandidate(
      { name: '痴人说梦.mp3', ar: [{ name: 'HOYO-MiX' }], duration: 115000 },
      { name: '痴人说梦', artist: ['HOYO-MiX'], durationMs: 115500 }
    ) > 0
  );
});

test('same titles never select a different singer or an artist substring', () => {
  const original = { name: 'How Long.mp3', artist: 'Charlie Puth' };
  for (const artist of ['Another Singer', 'Charlie Puth Tribute Band', 'Charlie']) {
    assert.equal(scoreKugouPlaybackCandidate(original, { name: 'How Long', artist }), 0);
  }
});

test('version annotations remain part of the title and reject studio/live/remix substitutions', () => {
  const original = { name: 'How Long.mp3', artist: 'Charlie Puth' };
  for (const name of ['How Long (Live)', 'How Long [Remix]', 'How Long (Instrumental)']) {
    assert.equal(scoreKugouPlaybackCandidate(original, { name, artist: 'Charlie Puth' }), 0);
  }
  assert.ok(
    scoreKugouPlaybackCandidate(
      { name: 'How Long (Live).flac', artist: 'Charlie Puth' },
      { name: 'How Long [Live]', artist: 'Charlie Puth' }
    ) > 0
  );
  assert.equal(stripAudioFileExtension('How Long (Live).flac'), 'How Long (Live)');
});

test('duration rejects clearly different cuts and prefers the closest acceptable cut', () => {
  const original = { name: 'Color Your Night.mp3', artist: 'Pealeaf', durationMs: 159000 };
  const candidate = { name: 'Color Your Night', artist: 'Pealeaf' };
  assert.equal(scoreKugouPlaybackCandidate(original, { ...candidate, dt: 320000 }), 0);
  assert.ok(scoreKugouPlaybackCandidate(original, { ...candidate, dt: 162000 }) > 0);
  assert.ok(
    scoreKugouPlaybackCandidate(original, { ...candidate, dt: 159000 }) >
      scoreKugouPlaybackCandidate(original, { ...candidate, dt: 162000 })
  );
});

test('missing duration is not a rejection, invalid duration does not bypass known dt', () => {
  const original = { name: 'Song', artist: 'Singer', durationMs: 180000 };
  assert.ok(scoreKugouPlaybackCandidate(original, { name: 'Song', artist: 'Singer' }) > 0);
  assert.equal(
    scoreKugouPlaybackCandidate(original, {
      name: 'Song',
      artist: 'Singer',
      durationMs: NaN,
      dt: 90000
    }),
    0
  );
});

test('Unicode, punctuation, case, and supported terminal audio extensions normalize', () => {
  const original = { name: ' Ｃａｆé — 夜.MP3 ', artist: 'Ｓｉｎｇｅｒ' };
  assert.ok(scoreKugouPlaybackCandidate(original, { name: 'cafe\u0301 夜', artist: 'singer' }) > 0);
  for (const extension of [
    'mp3',
    'FLAC',
    'wav',
    'm4a',
    'aac',
    'ogg',
    'opus',
    'wma',
    'ape',
    'aiff'
  ]) {
    assert.equal(stripAudioFileExtension(`Song (Remix).${extension}`), 'Song (Remix)');
  }
  assert.equal(stripAudioFileExtension('Song.mp3 (Live)'), 'Song.mp3 (Live)');
  assert.equal(stripAudioFileExtension('Song.mp3edit'), 'Song.mp3edit');
  assert.equal(stripAudioFileExtension('I Love MP3'), 'I Love MP3');
});

test('unknown artist metadata cannot produce an automatic title-only substitution', () => {
  const named = { name: 'Song.mp3', artist: 'Singer' };
  for (const artist of ['', '未知歌手', 'Unknown Artist', 'Various Artists', '群星']) {
    assert.equal(scoreKugouPlaybackCandidate(named, { name: 'Song', artist }), 0);
    assert.equal(scoreKugouPlaybackCandidate({ name: 'Song.mp3', artist }, named), 0);
  }
  assert.equal(buildKugouPlaybackSearchQuery({ name: 'Song.mp3', artist: '未知歌手' }), 'Song');
  assert.equal(scoreKugouPlaybackCandidate({ name: 'Song' }, { name: 'Song' }), 0);
});

test('artist metadata is deduplicated across ar/artists and band names are preserved', () => {
  const song = {
    name: 'Thunderstruck.mp3',
    ar: [{ name: 'AC/DC' }],
    artists: [{ name: 'AC/DC' }, { name: '未知歌手' }]
  };
  assert.deepEqual(getKugouPlaybackArtists(song), ['AC/DC']);
  assert.ok(scoreKugouPlaybackCandidate(song, { name: 'Thunderstruck', artist: 'AC/DC' }) > 0);
});

test('empty titles do not match or produce artist-only search queries', () => {
  assert.equal(buildKugouPlaybackSearchQuery({ name: '  ', artist: 'Singer' }), '');
  assert.equal(
    scoreKugouPlaybackCandidate({ name: '.mp3', artist: 'Singer' }, { name: '', artist: 'Singer' }),
    0
  );
});
