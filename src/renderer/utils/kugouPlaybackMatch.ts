/** The duration fields use milliseconds, as they do on imported Kugou and NetEase songs. */
export interface KugouPlaybackMetadata {
  name?: string;
  ar?: ReadonlyArray<{ name?: string }>;
  artists?: ReadonlyArray<{ name?: string }>;
  artist?: string | ReadonlyArray<string>;
  durationMs?: number;
  duration?: number;
  dt?: number;
}

const AUDIO_FILE_EXTENSION =
  /\.(?:mp3|flac|wav|wave|m4a|aac|ogg|opus|wma|ape|aiff|aif|alac|m4b|mp2|amr|dsf|dff)\s*$/i;
const UNKNOWN_ARTISTS = new Set([
  'unknown',
  'unknownartist',
  'unknownartists',
  'variousartists',
  '未知',
  '未知歌手',
  '未知艺术家',
  '未知艺人',
  '群星'
]);

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]/gu, '');
}

/** Remove a terminal audio filename extension; keep Live/Remix and other version text. */
export function stripAudioFileExtension(name: string): string {
  return name.normalize('NFKC').trim().replace(AUDIO_FILE_EXTENSION, '').trim();
}

/**
 * Kugou sometimes stores a duet in one artist name instead of separate artist records.
 * A spaced slash is a separator; an unspaced slash stays in names such as AC/DC.
 */
export function getKugouPlaybackArtists(song: KugouPlaybackMetadata): string[] {
  const names = [
    ...(song.ar || []).map((artist) => artist.name || ''),
    ...(song.artists || []).map((artist) => artist.name || ''),
    ...(typeof song.artist === 'string' ? [song.artist] : song.artist || [])
  ];
  const knownArtists = new Map<string, string>();
  for (const name of names) {
    for (const part of name.normalize('NFKC').split(/\s+\/\s*|\s*\/\s+|\s*[;|、]\s*/)) {
      const artist = part.trim();
      const normalized = normalizeText(artist);
      if (normalized && !UNKNOWN_ARTISTS.has(normalized) && !knownArtists.has(normalized)) {
        knownArtists.set(normalized, artist);
      }
    }
  }
  return [...knownArtists.values()];
}

export function buildKugouPlaybackSearchQuery(song: KugouPlaybackMetadata): string {
  const title = stripAudioFileExtension(song.name || '');
  if (!title) return '';
  return [title, ...getKugouPlaybackArtists(song)].join(' ').trim();
}

function durationMs(song: KugouPlaybackMetadata): number | undefined {
  for (const value of [song.durationMs, song.dt, song.duration]) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

/**
 * Zero means unsafe to substitute. A match requires the same normalized title and
 * at least one identical known artist, never a title-only or artist-substring match.
 * Both durations, when known, must be within 8 seconds or 5% of the shorter track.
 */
export function scoreKugouPlaybackCandidate(
  target: KugouPlaybackMetadata,
  candidate: KugouPlaybackMetadata
): number {
  const title = normalizeText(stripAudioFileExtension(target.name || ''));
  const candidateTitle = normalizeText(stripAudioFileExtension(candidate.name || ''));
  if (!title || !candidateTitle || title !== candidateTitle) return 0;

  const artists = getKugouPlaybackArtists(target).map(normalizeText);
  const candidateArtists = new Set(getKugouPlaybackArtists(candidate).map(normalizeText));
  const matchingArtists = artists.filter((artist) => candidateArtists.has(artist));
  if (!matchingArtists.length) return 0;

  const targetDuration = durationMs(target);
  const candidateDuration = durationMs(candidate);
  let durationScore = 0;
  if (targetDuration !== undefined && candidateDuration !== undefined) {
    const difference = Math.abs(targetDuration - candidateDuration);
    const tolerance = Math.max(8000, Math.min(targetDuration, candidateDuration) * 0.05);
    if (difference > tolerance) return 0;
    durationScore = 10 * (1 - difference / tolerance);
  }

  // Prefer complete artist lists and close durations among equally named candidates.
  return (
    100 +
    (matchingArtists.length / Math.max(artists.length, candidateArtists.size)) * 20 +
    durationScore
  );
}
